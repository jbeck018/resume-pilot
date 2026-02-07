// Resume Generation Workflow
// Migrated from Inngest to Cloudflare Workflows for better Cloudflare integration
// Uses 6-phase pipeline: Research -> Template -> Discovery -> Assembly -> Generation -> Save

import { WorkflowEntrypoint, WorkflowStep, NonRetryableError } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, ResumeGenerationParams, ResumeGenerationResult } from '../types';
import { createSupabaseClient } from '../utils/supabase';
import { generateWithClaude } from '../utils/anthropic';

export class ResumeGenerationWorkflow extends WorkflowEntrypoint<Env, ResumeGenerationParams> {
	async run(
		event: WorkflowEvent<ResumeGenerationParams>,
		step: WorkflowStep
	): Promise<ResumeGenerationResult> {
		const { userId, jobId, applicationId, skipUsageCheck = false } = event.payload;

		try {
			// Step 1: Check usage limits (unless skipped)
			if (!skipUsageCheck) {
				const usageCheck = await step.do('check-usage-limit', async () => {
					const supabase = createSupabaseClient(this.env);

					// Get user's subscription tier
					const { data: profile } = await supabase
						.from('profiles')
						.select('subscription_tier')
						.eq('user_id', userId)
						.single();

					const tier = profile?.subscription_tier || 'free';

					// Get usage count for current week
					const startOfWeek = new Date();
					startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
					startOfWeek.setHours(0, 0, 0, 0);

					const { count } = await supabase
						.from('job_applications')
						.select('*', { count: 'exact', head: true })
						.eq('user_id', userId)
						.eq('status', 'ready')
						.gte('created_at', startOfWeek.toISOString());

					const limits: Record<string, number> = {
						free: 5,
						starter: 25,
						professional: 100,
						unlimited: 999999
					};

					const limit = limits[tier] || 5;
					const used = count || 0;

					return {
						canGenerate: used < limit,
						used,
						limit
					};
				});

				if (!usageCheck.canGenerate) {
					// Mark application as limit exceeded
					await step.do('mark-limit-exceeded', async () => {
						const supabase = createSupabaseClient(this.env);
						await supabase
							.from('job_applications')
							.update({
								status: 'limit_exceeded',
								error_message: `Weekly limit reached (${usageCheck.used}/${usageCheck.limit})`,
								updated_at: new Date().toISOString()
							})
							.eq('id', applicationId);
					});

					return {
						success: false,
						error: 'usage_limit_exceeded'
					};
				}
			}

			// Step 2: Get job details
			const job = await step.do('get-job-details', async () => {
				const supabase = createSupabaseClient(this.env);
				const { data, error } = await supabase
					.from('jobs')
					.select('*')
					.eq('id', jobId)
					.eq('user_id', userId)
					.single();

				if (error) throw new Error(`Failed to get job: ${error.message}`);
				return data;
			});

			// Step 3: Get user profile and resume
			const userData = await step.do('get-user-data', async () => {
				const supabase = createSupabaseClient(this.env);

				const [profileResult, resumeResult] = await Promise.all([
					supabase.from('profiles').select('*').eq('user_id', userId).single(),
					supabase
						.from('resumes')
						.select('*')
						.eq('user_id', userId)
						.eq('is_default', true)
						.single()
				]);

				if (profileResult.error) {
					throw new Error(`Failed to get profile: ${profileResult.error.message}`);
				}

				return {
					profile: profileResult.data,
					resume: resumeResult.data
				};
			});

			// Step 4: Analyze job requirements
			const analysis = await step.do(
				'analyze-requirements',
				{ retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } },
				async () => {
					const prompt = `Analyze this job posting and extract key requirements:

Job Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Extract:
1. Required skills (must-have)
2. Preferred skills (nice-to-have)
3. Experience requirements
4. Key responsibilities
5. Company values/culture indicators

Return as JSON:
{
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "experienceYears": number,
  "keyResponsibilities": ["resp1", "resp2"],
  "cultureIndicators": ["indicator1", "indicator2"]
}`;

					const response = await generateWithClaude(this.env, {
						model: 'claude-3-5-haiku-20241022', // Use Haiku for analysis (cheaper)
						messages: [{ role: 'user', content: prompt }],
						maxTokens: 2048,
						temperature: 0.3
					});

					// Parse JSON from response
					let jsonText = response.trim();
					if (jsonText.startsWith('```json')) {
						jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
					} else if (jsonText.startsWith('```')) {
						jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
					}

					return JSON.parse(jsonText);
				}
			);

			// Step 5: Generate tailored resume
			const generatedResume = await step.do(
				'generate-resume',
				{ retries: { limit: 2, delay: '10 seconds', backoff: 'exponential' } },
				async () => {
					const profileSkills = userData.profile.skills || [];
					const profileExperience = userData.profile.experience || [];
					const resumeContent = userData.resume?.parsed_content || '';

					const prompt = `You are a professional resume writer. Create a tailored resume for this job application.

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Required Skills: ${analysis.requiredSkills.join(', ')}
Preferred Skills: ${analysis.preferredSkills.join(', ')}
Key Responsibilities: ${analysis.keyResponsibilities.join('; ')}

CANDIDATE PROFILE:
Name: ${userData.profile.full_name}
Email: ${userData.profile.email}
Skills: ${profileSkills.join(', ')}
Summary: ${userData.profile.summary || 'Not provided'}

EXISTING RESUME CONTENT:
${resumeContent}

EXPERIENCE:
${JSON.stringify(profileExperience, null, 2)}

INSTRUCTIONS:
1. Create a professional resume that highlights relevant skills and experience
2. Use action verbs and quantifiable achievements
3. Emphasize skills that match the job requirements
4. Keep it concise (1-2 pages worth of content)
5. Use ATS-friendly formatting

Return the resume content in markdown format.`;

					return generateWithClaude(this.env, {
						model: 'claude-sonnet-4-5-20250929', // Use Sonnet for generation (better quality)
						messages: [{ role: 'user', content: prompt }],
						maxTokens: 4096,
						temperature: 0.7
					});
				}
			);

			// Step 6: Calculate match scores
			const scores = await step.do('calculate-scores', async () => {
				const profileSkills = (userData.profile.skills || []).map((s: string) => s.toLowerCase());
				const requiredSkills = analysis.requiredSkills.map((s: string) => s.toLowerCase());
				const preferredSkills = analysis.preferredSkills.map((s: string) => s.toLowerCase());

				// Calculate match score
				const requiredMatches = requiredSkills.filter((skill: string) =>
					profileSkills.some((ps: string) => ps.includes(skill) || skill.includes(ps))
				).length;
				const preferredMatches = preferredSkills.filter((skill: string) =>
					profileSkills.some((ps: string) => ps.includes(skill) || skill.includes(ps))
				).length;

				const matchScore = Math.round(
					((requiredMatches / Math.max(requiredSkills.length, 1)) * 70 +
						(preferredMatches / Math.max(preferredSkills.length, 1)) * 30)
				);

				// Simple ATS score based on keyword presence
				const resumeLower = generatedResume.toLowerCase();
				const keywordMatches = [...requiredSkills, ...preferredSkills].filter((skill: string) =>
					resumeLower.includes(skill)
				).length;
				const totalKeywords = requiredSkills.length + preferredSkills.length;
				const atsScore = Math.round((keywordMatches / Math.max(totalKeywords, 1)) * 100);

				// Quality score based on resume length and structure
				const hasContact = resumeLower.includes('email') || resumeLower.includes('@');
				const hasExperience = resumeLower.includes('experience') || resumeLower.includes('work');
				const hasSkills = resumeLower.includes('skills');
				const qualityScore = Math.round(
					(generatedResume.length > 1000 ? 40 : 20) +
						(hasContact ? 20 : 0) +
						(hasExperience ? 20 : 0) +
						(hasSkills ? 20 : 0)
				);

				return { matchScore, atsScore, qualityScore };
			});

			// Step 7: Save to database
			await step.do('save-application', async () => {
				const supabase = createSupabaseClient(this.env);

				// Extract matched skills
				const profileSkills = (userData.profile.skills || []).map((s: string) => s.toLowerCase());
				const allRequiredSkills = analysis.requiredSkills.map((s: string) => s.toLowerCase());
				const matchedSkills = allRequiredSkills.filter((skill: string) =>
					profileSkills.some((ps: string) => ps.includes(skill) || skill.includes(ps))
				);

				// Calculate skill gaps
				const skillGaps = allRequiredSkills.filter(
					(skill: string) => !matchedSkills.includes(skill)
				);

				const { error } = await supabase
					.from('job_applications')
					.update({
						tailored_resume: generatedResume,
						match_score: scores.matchScore,
						ats_score: scores.atsScore,
						matched_skills: matchedSkills,
						skill_gaps: skillGaps,
						status: 'ready',
						updated_at: new Date().toISOString()
					})
					.eq('id', applicationId);

				if (error) throw new Error(`Failed to save: ${error.message}`);
			});

			return {
				success: true,
				matchScore: scores.matchScore,
				atsScore: scores.atsScore,
				qualityScore: scores.qualityScore,
				resumeLength: generatedResume.length
			};
		} catch (error) {
			// Mark application as failed
			await step.do('mark-failed', async () => {
				const supabase = createSupabaseClient(this.env);
				await supabase
					.from('job_applications')
					.update({
						status: 'failed',
						error_message: error instanceof Error ? error.message : 'Unknown error',
						updated_at: new Date().toISOString()
					})
					.eq('id', applicationId);
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
