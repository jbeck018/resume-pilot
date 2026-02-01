import { inngest } from '../client';
import { BudgetExceededError } from '$lib/server/llm/budget';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { usageService } from '$lib/server/subscription';
import {
	sendResumeReadyEmail,
	shouldSendEmail,
	parseEmailPreferences
} from '$lib/server/email';
import { Langfuse } from 'langfuse';
import {
	resumeGenerationAgentV2,
	type ResumeAgentInputV2,
	type ResumeAgentOutputV2
} from '$lib/server/agents/agents/resume-generation-v2';
import type { AgentContext, ProfileInfo, ExperienceItem, EducationItem } from '$lib/server/agents/types';

// Helper to create Supabase client - called lazily inside steps to reduce CPU overhead
// between step invocations in Cloudflare Workers (fixes error 1102)
function createSupabase() {
	return createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		cookies: {
			getAll: () => [],
			setAll: () => {}
		}
	});
}

// Resume generation workflow using ResumeGenerationAgentV2
// V2 features: 6-phase pipeline, gap analysis, confidence scoring, library patterns, reframing strategies
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

		// NOTE: Supabase client is now created INSIDE each step to avoid
		// CPU overhead on every Inngest step invocation (fixes Cloudflare error 1102)

		// Step 0: Check usage limits (unless explicitly skipped for admin/system operations)
		if (!skipUsageCheck) {
			const usageCheck = await step.run('check-usage-limit', async () => {
				const result = await usageService.checkUsageLimit(userId);
				return result;
			});

			if (!usageCheck.canGenerate) {
				// Mark application as limit_exceeded
				await step.run('mark-limit-exceeded', async () => {
					const supabase = createSupabase();
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
			const supabase = createSupabase();
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
			const supabase = createSupabase();
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

		// Validate required data before proceeding
		if (!job) {
			throw new Error('Job data not found');
		}
		if (!profile) {
			throw new Error('Profile data not found');
		}

		// Step 3: Generate resume using V2 agent with enhanced gap analysis and confidence scoring
		// Uses the 6-phase pipeline: Library Init -> Research -> Template -> Discovery -> Assembly -> Generation
		const applicationResult = await step.run('generate-resume-v2', async (): Promise<{
			resume: ResumeAgentOutputV2;
			traceId: string;
			costCents: number;
			durationMs: number;
		}> => {
			try {
				// Initialize Langfuse for tracing
				const langfuse = new Langfuse({
					publicKey: env.LANGFUSE_PUBLIC_KEY!,
					secretKey: env.LANGFUSE_SECRET_KEY!,
					baseUrl: env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
				});

				// Create trace for this generation
				const trace = langfuse.trace({
					name: 'resume-generation-v2',
					userId,
					metadata: {
						jobId,
						applicationId,
						company: job.company,
						position: job.title
					}
				});

				// Build the agent context
				const agentContext: AgentContext = {
					userId,
					jobId,
					applicationId,
					trace
				};

				// Map profile data to V2 format
				const profileInfo: ProfileInfo = {
					id: profile.id,
					fullName: profile.full_name || '',
					email: profile.email,
					headline: profile.headline || '',
					summary: profile.summary || '',
					skills: profile.skills || [],
					experience: (profile.experience || []).map((exp: Record<string, unknown>): ExperienceItem => ({
						title: exp.title as string,
						company: exp.company as string,
						description: exp.description as string,
						startDate: exp.start_date as string,
						endDate: exp.end_date as string | undefined,
						current: exp.current as boolean,
						location: exp.location as string | undefined,
						skills: exp.skills as string[] | undefined
					})),
					education: (profile.education || []).map((edu: Record<string, unknown>): EducationItem => ({
						institution: edu.institution as string,
						degree: edu.degree as string,
						field: edu.field as string | undefined,
						startDate: edu.start_date as string | undefined,
						endDate: edu.end_date as string | undefined
					})),
					location: profile.location,
					minSalary: profile.min_salary ?? undefined,
					maxSalary: profile.max_salary ?? undefined
				};

				// Build V2 agent input
				const agentInput: ResumeAgentInputV2 = {
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
					profile: profileInfo,
					resume: resume
						? {
								id: resume.id,
								name: resume.file_name,
								parsedContent: resume.parsed_content
							}
						: undefined,
					options: {
						includeResearch: true,
						useLibrary: true,
						enableDiscovery: false, // Disabled for async generation
						qualityThreshold: 70,
						maxRegenerationAttempts: 2
					}
				};

				// Execute the V2 agent
				const result = await resumeGenerationAgentV2.execute(agentInput, agentContext);

				// Ensure Langfuse data is flushed
				await langfuse.flushAsync();

				if (!result.success || !result.data) {
					throw new Error(result.error || 'Resume generation failed');
				}

				return {
					resume: result.data,
					traceId: result.traceId,
					costCents: result.costCents,
					durationMs: result.durationMs
				};
			} catch (error) {
				if (error instanceof BudgetExceededError) {
					// Budget exceeded - mark application as budget_exceeded
					const supabase = createSupabase();
					await supabase
						.from('job_applications')
						.update({ status: 'budget_exceeded', updated_at: new Date().toISOString() })
						.eq('id', applicationId);
				}
				console.error('Resume generation V2 failed:', error);
				throw error;
			}
		});

		// Step 4: Update application with generated content (V2 enhanced fields)
		await step.run('save-application', async () => {
			const supabase = createSupabase();
			const resumeData = applicationResult.resume;

			// Build confidence score JSONB
			const confidenceScore = {
				matchScore: resumeData.matchScore,
				atsScore: resumeData.atsScore,
				qualityScore: resumeData.qualityScore,
				generationAttempts: resumeData.generationAttempts,
				metadata: resumeData.metadata
			};

			// Build matched requirements JSONB (simplified for storage)
			const matchedRequirements = resumeData.matchedRequirements.map((req) => ({
				requirementId: req.requirementId,
				requirement: req.requirement,
				confidence: {
					overall: req.confidence.overall,
					tier: req.confidence.tier,
					breakdown: req.confidence.breakdown
				},
				selectedContent: req.selectedContent,
				hasReframing: !!req.reframingStrategy
			}));

			// Build assembly plan JSONB (simplified for storage)
			const assemblyPlan = {
				jobId: resumeData.assemblyPlan.jobId,
				gapsCount: resumeData.assemblyPlan.gaps.length,
				reframingCount: resumeData.assemblyPlan.reframingPlan.length,
				coverLetterRecommendationsCount: resumeData.assemblyPlan.coverLetterRecommendations.length
			};

			// Build reframing strategies JSONB
			const reframingStrategies = resumeData.matchedRequirements
				.filter((req) => req.reframingStrategy)
				.map((req) => ({
					requirementId: req.requirementId,
					type: req.reframingStrategy!.type,
					originalText: req.reframingStrategy!.originalText,
					reframedText: req.reframingStrategy!.reframedText,
					preservedMeaning: req.reframingStrategy!.preservedMeaning
				}));

			// Build cover letter recommendations JSONB
			const coverLetterRecommendations = resumeData.assemblyPlan.coverLetterRecommendations.map((rec) => ({
				gapId: rec.gapId,
				recommendation: rec.recommendation,
				suggestedPhrasing: rec.suggestedPhrasing,
				placement: rec.placement
			}));

			// Extract matched skills from V2 data
			const matchedSkills = resumeData.matchedRequirements
				.filter((req) => req.confidence.tier === 'direct' || req.confidence.tier === 'transferable')
				.map((req) => req.requirement);

			// Extract gaps as strings for backward compatibility
			const skillGaps = resumeData.gaps
				.filter((gap) => gap.severity !== 'minor')
				.map((gap) => `${gap.requirement} (${gap.severity}): ${gap.mitigationStrategies[0]?.description || 'No mitigation'}`);

			const { error } = await supabase
				.from('job_applications')
				.update({
					tailored_resume: resumeData.resume,
					cover_letter: null, // V2 doesn't generate cover letter in resume agent
					match_score: resumeData.matchScore,
					ats_score: resumeData.atsScore,
					matched_skills: matchedSkills,
					skill_gaps: skillGaps,
					generation_cost: applicationResult.costCents / 100, // Convert cents to dollars
					langfuse_trace_id: applicationResult.traceId,
					// V2 enhanced fields (JSONB)
					confidence_score: confidenceScore,
					matched_requirements: matchedRequirements,
					assembly_plan: assemblyPlan,
					reframing_strategies: reframingStrategies,
					cover_letter_recommendations: coverLetterRecommendations,
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
			const supabase = createSupabase();
			// Check if user wants to receive resume ready emails
			const emailPrefs = parseEmailPreferences(profile.email_preferences);
			if (!shouldSendEmail(emailPrefs, 'resumeReady')) {
				return { sent: false, reason: 'user_opted_out' };
			}

			const resumeData = applicationResult.resume;

			try {
				const result = await sendResumeReadyEmail(
					profile.email,
					userId,
					profile.full_name || '',
					jobId,
					job.title,
					job.company,
					resumeData.matchScore,
					resumeData.atsScore
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
						matchScore: resumeData.matchScore,
						atsScore: resumeData.atsScore,
						qualityScore: resumeData.qualityScore
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

		const resumeData = applicationResult.resume;

		return {
			success: true,
			jobId,
			applicationId,
			// V2 enhanced response
			matchScore: resumeData.matchScore,
			atsScore: resumeData.atsScore,
			qualityScore: resumeData.qualityScore,
			resumeLength: resumeData.resume.length,
			coverLetterLength: 0, // V2 resume agent doesn't generate cover letter
			highlights: resumeData.highlights,
			gapsCount: resumeData.gaps.length,
			matchedRequirementsCount: resumeData.matchedRequirements.length,
			generationAttempts: resumeData.generationAttempts,
			libraryPatternsApplied: resumeData.libraryPatternsApplied?.length || 0,
			totalCost: applicationResult.costCents / 100,
			totalDurationMs: applicationResult.durationMs,
			phaseDurations: resumeData.metadata,
			traceId: applicationResult.traceId,
			emailSent: emailResult.sent
		};
	}
);
