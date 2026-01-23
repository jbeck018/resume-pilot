import { inngest } from '../client';
import { generateApplication, type ApplicationGenerationInput } from '$lib/server/agents/orchestrator';
import { BudgetExceededError } from '$lib/server/llm/budget';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { usageService } from '$lib/server/subscription';
import { UsageLimitExceededError } from '$lib/server/subscription/errors';
import {
	sendResumeReadyEmail,
	shouldSendEmail,
	parseEmailPreferences
} from '$lib/server/email';

// Resume generation workflow using agentic orchestrator
export const generateResumeForJob = inngest.createFunction(
	{
		id: 'generate-resume-for-job',
		name: 'Generate Resume for Job',
		retries: 3,
		concurrency: {
			limit: 5 // Limit concurrent agent executions
		}
	},
	{ event: 'resume/generation.requested' },
	async ({ event, step }) => {
		const { userId, jobId, applicationId, skipUsageCheck = false } = event.data;

		const supabase = createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});

		// Step 0: Check usage limits (unless explicitly skipped for admin/system operations)
		if (!skipUsageCheck) {
			const usageCheck = await step.run('check-usage-limit', async () => {
				const result = await usageService.checkUsageLimit(userId);
				return result;
			});

			if (!usageCheck.canGenerate) {
				// Mark application as limit_exceeded
				await step.run('mark-limit-exceeded', async () => {
					// Note: usageCheck.resetsAt is already a string because Inngest serializes step results to JSON
					const resetsAtStr = typeof usageCheck.resetsAt === 'string'
						? usageCheck.resetsAt
						: new Date(usageCheck.resetsAt).toISOString();
					await supabase
						.from('job_applications')
						.update({
							status: 'limit_exceeded',
							error_message: `Weekly generation limit reached (${usageCheck.generationsUsed}/${usageCheck.generationLimit}). Resets ${resetsAtStr}`,
							updated_at: new Date().toISOString()
						})
						.eq('id', applicationId);
				});

				return {
					success: false,
					error: 'usage_limit_exceeded',
					jobId,
					applicationId,
					usageInfo: {
						used: usageCheck.generationsUsed,
						limit: usageCheck.generationLimit,
						remaining: usageCheck.remaining,
						resetsAt: typeof usageCheck.resetsAt === 'string'
							? usageCheck.resetsAt
							: new Date(usageCheck.resetsAt).toISOString()
					}
				};
			}
		}

		// Step 1: Get job details
		const job = await step.run('get-job-details', async () => {
			const { data, error } = await supabase
				.from('jobs')
				.select('*')
				.eq('id', jobId)
				.eq('user_id', userId)
				.single();

			if (error) throw new Error(`Failed to get job: ${error.message}`);
			return data;
		});

		// Step 2: Get user profile and default resume
		const { profile, resume } = await step.run('get-user-data', async () => {
			const [profileResult, resumeResult] = await Promise.all([
				supabase.from('profiles').select('*').eq('user_id', userId).single(),
				supabase
					.from('resumes')
					.select('*')
					.eq('user_id', userId)
					.eq('is_default', true)
					.single()
			]);

			if (profileResult.error) throw new Error(`Failed to get profile: ${profileResult.error.message}`);

			return {
				profile: profileResult.data,
				resume: resumeResult.data
			};
		});

		// Step 3: Generate application using agentic orchestrator
		// This coordinates ResumeAgent, CoverLetterAgent, and JobMatchAgent
		// All traced via Langfuse with proper hierarchy
		const applicationResult = await step.run('generate-application', async () => {
			try {
				const input: ApplicationGenerationInput = {
					userId,
					job: {
						id: jobId,
						title: job.title,
						company: job.company,
						description: job.description || '',
						requirements: job.requirements || [],
						location: job.location,
						isRemote: job.is_remote,
						sourceUrl: job.source_url || ''
					},
					profile: {
						id: profile.id,
						fullName: profile.full_name || '',
						email: profile.email,
						headline: profile.headline || '',
						summary: profile.summary || '',
						skills: profile.skills || [],
						experience: (profile.experience || []).map((exp: Record<string, unknown>) => ({
							title: exp.title as string,
							company: exp.company as string,
							description: exp.description as string,
							startDate: exp.start_date as string,
							endDate: exp.end_date as string | undefined,
							current: exp.current as boolean,
							location: exp.location as string | undefined,
							skills: exp.skills as string[] | undefined
						})),
						education: (profile.education || []).map((edu: Record<string, unknown>) => ({
							institution: edu.institution as string,
							degree: edu.degree as string,
							field: edu.field as string | undefined,
							startDate: edu.start_date as string | undefined,
							endDate: edu.end_date as string | undefined
						})),
						location: profile.location,
						minSalary: profile.min_salary ?? undefined,
						maxSalary: profile.max_salary ?? undefined
					},
					resume: resume
						? {
								id: resume.id,
								name: resume.file_name,
								parsedContent: resume.parsed_content
							}
						: undefined,
					options: {
						includeResearch: true,
						generateCoverLetter: true,
						tone: 'conversational'
					}
				};

				return await generateApplication(input);
			} catch (error) {
				if (error instanceof BudgetExceededError) {
					// Budget exceeded - mark application as budget_exceeded
					await supabase
						.from('job_applications')
						.update({ status: 'budget_exceeded', updated_at: new Date().toISOString() })
						.eq('id', applicationId);
				}
				console.error('Application generation failed:', error);
				throw error;
			}
		});

		// Step 4: Update application with generated content
		await step.run('save-application', async () => {
			const { error } = await supabase
				.from('job_applications')
				.update({
					tailored_resume: applicationResult.resume.resume,
					cover_letter: applicationResult.coverLetter?.coverLetter || null,
					match_score: applicationResult.matchScore.overallScore,
					ats_score: applicationResult.resume.atsScore,
					matched_skills: applicationResult.resume.matchedSkills,
					skill_gaps: applicationResult.resume.gaps,
					generation_cost: applicationResult.totalCostCents / 100, // Convert cents to dollars
					langfuse_trace_id: applicationResult.traceId,
					status: 'ready',
					updated_at: new Date().toISOString()
				})
				.eq('id', applicationId);

			if (error) throw new Error(`Failed to save application: ${error.message}`);
		});

		// Step 5: Increment usage counter (only if we didn't skip usage check)
		if (!skipUsageCheck) {
			await step.run('increment-usage', async () => {
				const result = await usageService.incrementUsage(userId, 'generation');
				return result;
			});
		}

		// Step 6: Send resume ready email notification
		const emailResult = await step.run('send-resume-ready-email', async () => {
			// Check if user wants to receive resume ready emails
			const emailPrefs = parseEmailPreferences(profile.email_preferences);
			if (!shouldSendEmail(emailPrefs, 'resumeReady')) {
				return { sent: false, reason: 'user_opted_out' };
			}

			try {
				const result = await sendResumeReadyEmail(
					profile.email,
					userId,
					profile.full_name || '',
					jobId,
					job.title,
					job.company,
					applicationResult.matchScore.overallScore,
					applicationResult.resume.atsScore
				);

				// Log email send to history
				await supabase.from('email_send_history').insert({
					user_id: userId,
					email_type: 'resume_ready',
					recipient_email: profile.email,
					subject: `Your Resume for ${job.company} is Ready!`,
					message_id: result.messageId,
					status: result.success ? 'sent' : 'failed',
					error_message: result.error,
					metadata: {
						jobId,
						jobTitle: job.title,
						company: job.company,
						matchScore: applicationResult.matchScore.overallScore,
						atsScore: applicationResult.resume.atsScore
					}
				});

				return {
					sent: result.success,
					messageId: result.messageId,
					error: result.error
				};
			} catch (error) {
				console.error('Failed to send resume ready email:', error);
				return { sent: false, reason: 'email_error', error: (error as Error).message };
			}
		});

		return {
			success: true,
			jobId,
			applicationId,
			matchScore: applicationResult.matchScore.overallScore,
			atsScore: applicationResult.resume.atsScore,
			resumeLength: applicationResult.resume.resume.length,
			coverLetterLength: applicationResult.coverLetter?.coverLetter.length || 0,
			totalCost: applicationResult.totalCostCents / 100,
			totalDurationMs: applicationResult.totalDurationMs,
			traceId: applicationResult.traceId,
			emailSent: emailResult.sent
		};
	}
);
