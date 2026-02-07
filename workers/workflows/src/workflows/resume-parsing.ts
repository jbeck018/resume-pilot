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

Extract the following information in valid JSON format:
{
  "name": "Full name of the candidate",
  "email": "Email address",
  "phone": "Phone number",
  "summary": "Professional summary or objective",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "Location",
      "startDate": "Start date (YYYY-MM format)",
      "endDate": "End date (YYYY-MM format) or null if current",
      "current": true/false,
      "description": "Job description",
      "skills": ["skill1", "skill2", ...]
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree type",
      "field": "Field of study",
      "startDate": "Start date (YYYY-MM format)",
      "endDate": "End date (YYYY-MM format)",
      "gpa": "GPA if mentioned"
    }
  ],
  "certifications": ["certification1", "certification2", ...],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description",
      "url": "Project URL if available"
    }
  ]
}

IMPORTANT:
- Extract ALL available information from both text and visual elements
- Pay attention to resume formatting, section headers, and layout
- Use null for missing fields
- Normalize dates to YYYY-MM format when possible
- Extract skills from experience descriptions if not explicitly listed
- Return ONLY valid JSON, no additional text or markdown`;

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
						// Use Claude's native PDF support
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
									}
								]
							})
						});

						if (!response.ok) {
							throw new Error(`Claude API error: ${response.status}`);
						}

						const result = await response.json() as {
							content: Array<{ type: string; text?: string }>;
						};
						const textBlock = result.content.find(b => b.type === 'text');
						if (!textBlock || !textBlock.text) {
							throw new Error('No text response from Claude');
						}

						let jsonText = textBlock.text.trim();
						if (jsonText.startsWith('```json')) {
							jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
						} else if (jsonText.startsWith('```')) {
							jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
						}

						const structured = JSON.parse(jsonText);

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
								}
							],
							maxTokens: 4096,
							temperature: 0.3
						});

						let jsonText = response.trim();
						if (jsonText.startsWith('```json')) {
							jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
						} else if (jsonText.startsWith('```')) {
							jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
						}

						const structured = JSON.parse(jsonText);
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
