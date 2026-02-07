// Resume Parsing Workflow
// Parses PDF/DOCX resumes using Claude's native PDF support or mammoth for DOCX
// Extracts structured data and updates user profile

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, ResumeParsingParams, ResumeParsingResult } from '../types';
import { createSupabaseClient } from '../utils/supabase';
import { generateWithClaude } from '../utils/anthropic';

// Prompt for structured resume extraction
const RESUME_EXTRACTION_PROMPT = `You are a resume parsing expert. Analyze this resume and extract structured information.

You MUST respond with ONLY valid JSON in this exact format - no explanations, no apologies, no markdown:
{
  "name": "Full name of the candidate",
  "email": "Email address or null",
  "phone": "Phone number or null",
  "summary": "Professional summary or objective or null",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "Location or null",
      "startDate": "Start date (YYYY-MM format) or null",
      "endDate": "End date (YYYY-MM format) or null if current",
      "current": true,
      "description": "Job description",
      "skills": ["skill1", "skill2"]
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree type",
      "field": "Field of study or null",
      "startDate": "Start date (YYYY-MM format) or null",
      "endDate": "End date (YYYY-MM format) or null",
      "gpa": "GPA if mentioned or null"
    }
  ],
  "certifications": ["certification1", "certification2"],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description",
      "url": "Project URL or null"
    }
  ]
}

CRITICAL RULES:
- ALWAYS output valid JSON even if resume content is unclear or incomplete
- Use null for any fields you cannot determine
- Use empty arrays [] if no items found for that category
- NEVER apologize or explain - ONLY output the JSON object
- If the document is unreadable, still output valid JSON with null values
- Extract information from both text and visual elements when present`;

// Helper to safely parse JSON from Claude response
function parseClaudeJsonResponse(text: string): Record<string, unknown> {
	let jsonText = text.trim();

	// Remove markdown code blocks if present
	if (jsonText.startsWith('```json')) {
		jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
	} else if (jsonText.startsWith('```')) {
		jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
	}

	// Check for non-JSON responses (apologies, explanations, etc.)
	const lowerText = jsonText.toLowerCase();
	if (lowerText.startsWith('i ') || lowerText.startsWith('i\'') ||
	    lowerText.startsWith('sorry') || lowerText.startsWith('unfortunately') ||
	    lowerText.startsWith('the ') || lowerText.startsWith('this ')) {
		throw new Error(`Claude returned a non-JSON response. First 100 chars: "${jsonText.substring(0, 100)}..."`);
	}

	// Try to find JSON object if response has extra text
	const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		jsonText = jsonMatch[0];
	}

	try {
		return JSON.parse(jsonText);
	} catch (e) {
		throw new Error(`Failed to parse JSON response. First 100 chars: "${jsonText.substring(0, 100)}..."`);
	}
}

export class ResumeParsingWorkflow extends WorkflowEntrypoint<Env, ResumeParsingParams> {
	async run(
		event: WorkflowEvent<ResumeParsingParams>,
		step: WorkflowStep
	): Promise<ResumeParsingResult> {
		const { userId, resumeId, fileUrl, fileType } = event.payload;

		try {
			// Step 1: Download the resume file
			const fileData = await step.do('download-file', async () => {
				const supabase = createSupabaseClient(this.env);

				// Extract file path from URL
				const urlParts = fileUrl.split('/resumes/');
				if (urlParts.length !== 2) {
					throw new Error('Invalid file URL format');
				}
				const filePath = urlParts[1];

				const { data, error } = await supabase.storage.from('resumes').download(filePath);

				if (error) {
					throw new Error(`Failed to download file: ${error.message}`);
				}

				// Convert Blob to base64 for serialization
				const arrayBuffer = await data.arrayBuffer();
				const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
				return { base64, size: arrayBuffer.byteLength };
			});

			// Step 2: Parse and extract structured data
			const parsedData = await step.do(
				'parse-and-structure',
				{ retries: { limit: 2, delay: '10 seconds', backoff: 'exponential' } },
				async () => {
					const fileBuffer = Uint8Array.from(atob(fileData.base64), c => c.charCodeAt(0));

					if (fileType === 'pdf') {
						// Use Claude's native PDF support with prefill to force JSON
						const response = await fetch('https://api.anthropic.com/v1/messages', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'x-api-key': this.env.ANTHROPIC_API_KEY,
								'anthropic-version': '2023-06-01'
							},
							body: JSON.stringify({
								model: 'claude-sonnet-4-5-20250929',
								max_tokens: 4096,
								messages: [
									{
										role: 'user',
										content: [
											{
												type: 'document',
												source: {
													type: 'base64',
													media_type: 'application/pdf',
													data: fileData.base64
												}
											},
											{
												type: 'text',
												text: RESUME_EXTRACTION_PROMPT
											}
										]
									},
									{
										// Prefill forces Claude to start with JSON
										role: 'assistant',
										content: '{'
									}
								]
							})
						});

						if (!response.ok) {
							const errorBody = await response.text().catch(() => 'Unable to read error body');
							throw new Error(`Claude API error: ${response.status} - ${errorBody.substring(0, 200)}`);
						}

						const result = await response.json() as {
							content: Array<{ type: string; text?: string }>;
						};
						const textBlock = result.content.find(b => b.type === 'text');
						if (!textBlock || !textBlock.text) {
							throw new Error('No text response from Claude');
						}

						// Prepend the '{' we used as prefill
						const fullResponse = '{' + textBlock.text;
						const structured = parseClaudeJsonResponse(fullResponse);

						// Build text summary for storage
						const textSummary = [
							structured.name,
							structured.email,
							structured.phone,
							structured.summary,
							'Skills: ' + (structured.skills?.join(', ') || ''),
							...(structured.experience?.map(
								(e: { title: string; company: string; description: string }) =>
									`${e.title} at ${e.company}: ${e.description}`
							) || []),
							...(structured.education?.map(
								(e: { degree: string; field: string; institution: string }) =>
									`${e.degree} in ${e.field} from ${e.institution}`
							) || [])
						]
							.filter(Boolean)
							.join('\n\n');

						return { extractedText: textSummary, structuredData: structured };
					} else if (fileType === 'docx') {
						// For DOCX, we need to extract text first
						// Note: mammoth may not work in Workers, so we'll use a simpler approach
						// or call an external service

						// For now, send raw text to Claude (DOCX support may need external processing)
						const textContent = new TextDecoder().decode(fileBuffer);

						const response = await generateWithClaude(this.env, {
							model: 'claude-3-5-haiku-20241022',
							messages: [
								{
									role: 'user',
									content: `${RESUME_EXTRACTION_PROMPT}\n\nResume Content:\n${textContent.substring(0, 50000)}`
								},
								{
									// Prefill forces Claude to start with JSON
									role: 'assistant',
									content: '{'
								}
							],
							maxTokens: 4096,
							temperature: 0.3
						});

						// Prepend the '{' we used as prefill
						const fullResponse = '{' + response;
						const structured = parseClaudeJsonResponse(fullResponse);
						return { extractedText: textContent.substring(0, 50000), structuredData: structured };
					} else {
						throw new Error(`Unsupported file type: ${fileType}`);
					}
				}
			);

			// Step 3: Save parsed data to resume record
			await step.do('save-parsed-data', async () => {
				const supabase = createSupabaseClient(this.env);
				const { error } = await supabase
					.from('resumes')
					.update({
						parsed_content: parsedData.extractedText,
						structured_data: parsedData.structuredData,
						updated_at: new Date().toISOString()
					})
					.eq('id', resumeId);

				if (error) {
					throw new Error(`Failed to update resume: ${error.message}`);
				}
			});

			// Step 4: Update user profile with extracted data (if not already set)
			await step.do('update-profile', async () => {
				const supabase = createSupabaseClient(this.env);
				const structured = parsedData.structuredData;

				// Get current profile
				const { data: profile, error: profileError } = await supabase
					.from('profiles')
					.select('full_name, summary, skills, experience, education')
					.eq('user_id', userId)
					.single();

				if (profileError) {
					console.error('Failed to get profile:', profileError);
					return;
				}

				// Only update empty fields
				const updates: Record<string, unknown> = {
					updated_at: new Date().toISOString()
				};

				if (!profile.full_name && structured.name) {
					updates.full_name = structured.name;
				}
				if (!profile.summary && structured.summary) {
					updates.summary = structured.summary;
				}
				if ((!profile.skills || profile.skills.length === 0) && structured.skills?.length > 0) {
					updates.skills = structured.skills;
				}
				if (
					(!profile.experience || profile.experience.length === 0) &&
					structured.experience?.length > 0
				) {
					updates.experience = structured.experience;
				}
				if (
					(!profile.education || profile.education.length === 0) &&
					structured.education?.length > 0
				) {
					updates.education = structured.education;
				}

				if (Object.keys(updates).length > 1) {
					await supabase.from('profiles').update(updates).eq('user_id', userId);
				}
			});

			return {
				success: true,
				extractedLength: parsedData.extractedText.length,
				skillsCount: parsedData.structuredData.skills?.length || 0,
				experienceCount: parsedData.structuredData.experience?.length || 0,
				educationCount: parsedData.structuredData.education?.length || 0
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
