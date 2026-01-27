import { inngest } from '../client';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import mammoth from 'mammoth';
import type { ResumeStructuredData } from '$lib/server/database/schema';

// Get Anthropic provider (optionally through Cloudflare AI Gateway)
function getAnthropicProvider() {
	const baseURL = env.CLOUDFLARE_AI_GATEWAY_URL
		? `${env.CLOUDFLARE_AI_GATEWAY_URL}/anthropic`
		: undefined;

	return createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY,
		baseURL
	});
}

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

// Resume parsing workflow
export const parseResumeFile = inngest.createFunction(
	{
		id: 'parse-resume-file',
		name: 'Parse Resume File',
		retries: 2,
		concurrency: {
			limit: 3
		}
	},
	{ event: 'resume/parsing.requested' },
	async ({ event, step }) => {
		const { userId, resumeId, fileUrl, fileType } = event.data;

		const supabase = createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});

		// Step 1: Download the resume file from Supabase Storage
		const fileData = await step.run('download-file', async () => {
			// Extract the file path from the public URL
			// URL format: https://{project}.supabase.co/storage/v1/object/public/resumes/{path}
			const urlParts = fileUrl.split('/resumes/');
			if (urlParts.length !== 2) {
				throw new Error('Invalid file URL format');
			}
			const filePath = urlParts[1];

			const { data, error } = await supabase.storage.from('resumes').download(filePath);

			if (error) {
				throw new Error(`Failed to download file: ${error.message}`);
			}

			// Convert Blob to ArrayBuffer and return as array for Inngest serialization
			const arrayBuffer = await data.arrayBuffer();
			return Array.from(new Uint8Array(arrayBuffer));
		});

		// Step 2 & 3 combined: Extract text and structure content
		// For PDFs, we use Claude's native PDF support to do both in one step
		// For DOCX, we extract text first then send to Claude
		const { extractedText, structuredData } = await step.run('parse-and-structure', async () => {
			const fileBuffer = new Uint8Array(fileData);
			const anthropic = getAnthropicProvider();

			if (fileType === 'pdf') {
				// Use Claude's native PDF support - sends PDF directly to Claude
				// This provides better accuracy for complex layouts, tables, and visual elements
				const result = await generateText({
					model: anthropic('claude-3-5-sonnet-20241022'),
					messages: [
						{
							role: 'user',
							content: [
								{
									type: 'file',
									data: fileBuffer,
									mimeType: 'application/pdf'
								},
								{
									type: 'text',
									text: RESUME_EXTRACTION_PROMPT
								}
							]
						}
					],
					maxTokens: 4096,
					temperature: 0.3
				});

				// Parse JSON response
				let jsonText = result.text.trim();
				if (jsonText.startsWith('```json')) {
					jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
				} else if (jsonText.startsWith('```')) {
					jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
				}

				const parsed = JSON.parse(jsonText) as ResumeStructuredData;

				// For PDF, we don't have raw text separately, so we'll construct a summary
				const textSummary = [
					parsed.name,
					parsed.email,
					parsed.phone,
					parsed.summary,
					'Skills: ' + (parsed.skills?.join(', ') || ''),
					...(parsed.experience?.map(
						(e) => `${e.title} at ${e.company}: ${e.description}`
					) || []),
					...(parsed.education?.map(
						(e) => `${e.degree} in ${e.field} from ${e.institution}`
					) || [])
				]
					.filter(Boolean)
					.join('\n\n');

				return { extractedText: textSummary, structuredData: parsed };
			} else if (fileType === 'docx') {
				// For DOCX, extract text with mammoth first
				const result = await mammoth.extractRawText({
					buffer: Buffer.from(fileBuffer)
				});
				const text = result.value;

				// Then send to Claude for structuring
				const llmResult = await generateText({
					model: anthropic('claude-3-haiku-20240307'), // Use Haiku for text-only (cheaper)
					messages: [
						{
							role: 'user',
							content: `${RESUME_EXTRACTION_PROMPT}\n\nResume Text:\n${text}`
						}
					],
					maxTokens: 4096,
					temperature: 0.3
				});

				let jsonText = llmResult.text.trim();
				if (jsonText.startsWith('```json')) {
					jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
				} else if (jsonText.startsWith('```')) {
					jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
				}

				const parsed = JSON.parse(jsonText) as ResumeStructuredData;
				return { extractedText: text, structuredData: parsed };
			} else {
				throw new Error(`Unsupported file type: ${fileType}`);
			}
		});

		// Step 4: Update the resume record with parsed content and structured data
		await step.run('save-parsed-data', async () => {
			const { error } = await supabase
				.from('resumes')
				.update({
					parsed_content: extractedText,
					structured_data: structuredData,
					updated_at: new Date().toISOString()
				})
				.eq('id', resumeId);

			if (error) {
				throw new Error(`Failed to update resume: ${error.message}`);
			}
		});

		// Step 5: Update user profile with extracted data (if not already set)
		await step.run('update-profile-from-resume', async () => {
			// Get current profile
			const { data: profile, error: profileError } = await supabase
				.from('profiles')
				.select('full_name, summary, skills, experience, education')
				.eq('user_id', userId)
				.single();

			if (profileError) {
				console.error('Failed to get profile:', profileError);
				return; // Don't fail the entire job for this
			}

			// Only update if profile fields are empty
			const updates: {
				full_name?: string;
				summary?: string;
				skills?: string[];
				experience?: unknown[];
				education?: unknown[];
				updated_at: string;
			} = {
				updated_at: new Date().toISOString()
			};

			// Update name if not set
			if (!profile.full_name && structuredData.name) {
				updates.full_name = structuredData.name;
			}

			// Update summary if not set
			if (!profile.summary && structuredData.summary) {
				updates.summary = structuredData.summary;
			}

			// Update skills if not set
			if ((!profile.skills || profile.skills.length === 0) && structuredData.skills && structuredData.skills.length > 0) {
				updates.skills = structuredData.skills;
			}

			// Update experience if not set
			if (
				(!profile.experience || profile.experience.length === 0) &&
				structuredData.experience &&
				structuredData.experience.length > 0
			) {
				updates.experience = structuredData.experience;
			}

			// Update education if not set
			if (
				(!profile.education || profile.education.length === 0) &&
				structuredData.education &&
				structuredData.education.length > 0
			) {
				updates.education = structuredData.education;
			}

			// Only update if we have changes
			if (Object.keys(updates).length > 1) {
				const { error: updateError } = await supabase
					.from('profiles')
					.update(updates)
					.eq('user_id', userId);

				if (updateError) {
					console.error('Failed to update profile:', updateError);
				}
			}
		});

		return {
			success: true,
			resumeId,
			extractedLength: extractedText.length,
			skillsCount: structuredData.skills?.length || 0,
			experienceCount: structuredData.experience?.length || 0,
			educationCount: structuredData.education?.length || 0
		};
	}
);
