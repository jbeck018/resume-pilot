import { inngest } from '../client';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { complete, selectModel } from '$lib/server/llm/client';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import type { ResumeStructuredData } from '$lib/server/database/schema';

// pdf-parse is CommonJS and needs special handling in ESM
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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

		const supabase = createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

		// Step 2: Extract text content from the file
		const extractedText = await step.run('extract-text', async () => {
			// Convert array back to Buffer for parsing
			const fileBuffer = Buffer.from(fileData);

			if (fileType === 'pdf') {
				// Parse PDF
				const pdfData = await pdfParse(fileBuffer);
				return pdfData.text;
			} else if (fileType === 'docx') {
				// Parse DOCX
				const result = await mammoth.extractRawText({
					buffer: fileBuffer
				});
				return result.value;
			} else {
				throw new Error(`Unsupported file type: ${fileType}`);
			}
		});

		// Step 3: Use LLM to structure the extracted content
		const structuredData = await step.run('structure-content', async () => {
			const prompt = `You are a resume parsing expert. Extract structured information from the following resume text.

Resume Text:
${extractedText}

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

Important:
- Extract ALL available information
- Use null for missing fields
- Normalize dates to YYYY-MM format when possible
- Extract skills from experience descriptions if not explicitly listed
- Return ONLY valid JSON, no additional text`;

			const result = await complete({
				model: selectModel('summary'), // Use fast Haiku model for parsing
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				maxTokens: 4096,
				temperature: 0.3, // Lower temperature for more consistent parsing
				userId,
				metadata: {
					purpose: 'resume-parsing',
					resumeId
				}
			});

			// Parse the JSON response
			try {
				// Extract JSON from the response (handle potential markdown formatting)
				let jsonText = result.content.trim();

				// Remove markdown code blocks if present
				if (jsonText.startsWith('```json')) {
					jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
				} else if (jsonText.startsWith('```')) {
					jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
				}

				const parsed = JSON.parse(jsonText) as ResumeStructuredData;
				return parsed;
			} catch (error) {
				console.error('Failed to parse LLM response as JSON:', error);
				console.error('Response:', result.content);
				throw new Error('Failed to parse structured resume data from LLM response');
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

		// Step 5: Update user profile with extracted skills (if not already set)
		if (structuredData.skills && structuredData.skills.length > 0) {
			await step.run('update-profile-skills', async () => {
				// Get current profile
				const { data: profile, error: profileError } = await supabase
					.from('profiles')
					.select('skills, experience, education')
					.eq('user_id', userId)
					.single();

				if (profileError) {
					console.error('Failed to get profile:', profileError);
					return; // Don't fail the entire job for this
				}

				// Only update if profile fields are empty
				const updates: {
					skills?: string[];
					experience?: unknown[];
					education?: unknown[];
					updated_at: string;
				} = {
					updated_at: new Date().toISOString()
				};

				if (!profile.skills || profile.skills.length === 0) {
					updates.skills = structuredData.skills;
				}

				if (
					(!profile.experience || profile.experience.length === 0) &&
					structuredData.experience &&
					structuredData.experience.length > 0
				) {
					updates.experience = structuredData.experience;
				}

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
		}

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
