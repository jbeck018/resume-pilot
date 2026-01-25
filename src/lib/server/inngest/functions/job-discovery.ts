import { inngest } from '../client';
import { searchAdzunaJobs } from '$lib/server/jobs/adzuna';
import { searchMuseJobs } from '$lib/server/jobs/muse';
import { searchGreenhouseJobs } from '$lib/server/jobs/greenhouse';
import { searchLeverJobs } from '$lib/server/jobs/lever';
import { searchRemoteOKJobs } from '$lib/server/jobs/remoteok';
import { searchWeWorkRemotelyJobs } from '$lib/server/jobs/weworkremotely';
import { searchJoobleJobs } from '$lib/server/jobs/jooble';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { usageService } from '$lib/server/subscription';
import {
	generateEmbedding,
	buildJobText,
	getProfileEmbedding,
	scoreJobsWithEmbeddings,
	type JobEmbeddingInput
} from '$lib/server/embeddings';
import {
	loadLearnedPreferences,
	applyPreferencesToScore,
	type LearnedPreferences
} from '$lib/server/learning';
import type { JobResult } from '$lib/server/jobs/types';
import {
	sendJobMatchesDigest,
	shouldSendEmail,
	parseEmailPreferences,
	type JobMatch
} from '$lib/server/email';

// Type for job with embedding attached (after Inngest JSON serialization)
type JobWithEmbedding = JobResult & { embedding: number[] | null };

// Type for scored job (after Inngest JSON serialization)
type ScoredJob = JobWithEmbedding & {
	matchScore: number;
	baseMatchScore: number;
	learningAdjustment: number;
	matchReasons: string[];
	usedEmbedding: boolean;
	usedLearning: boolean;
};

// Minimum score threshold for embedding-based matching
const EMBEDDING_MATCH_THRESHOLD = 30;
const EMBEDDING_DIMENSIONS = 1536;

// Daily job discovery workflow
export const dailyJobDiscovery = inngest.createFunction(
	{
		id: 'daily-job-discovery',
		name: 'Daily Job Discovery'
	},
	{ event: 'job/discovery.requested' },
	async ({ event, step }) => {
		const { userId } = event.data;

		// Create Supabase client with service role for server-side operations
		const supabase = createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});

		// Step 1: Get user profile and preferences
		const profile = await step.run('get-user-profile', async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('user_id', userId)
				.single();

			if (error) throw new Error(`Failed to get profile: ${error.message}`);
			return data;
		});

		// Step 2: Get profile embedding if available
		const profileEmbedding = await step.run('get-profile-embedding', async () => {
			try {
				const embedding = await getProfileEmbedding(userId);
				return embedding;
			} catch (error) {
				console.error('Failed to get profile embedding:', error);
				return null;
			}
		});

		const hasEmbedding =
			profileEmbedding &&
			Array.isArray(profileEmbedding) &&
			profileEmbedding.length === EMBEDDING_DIMENSIONS;

		// Step 2.5: Load learned preferences from user feedback history
		const learnedPreferences = await step.run('load-learned-preferences', async () => {
			try {
				const preferences = await loadLearnedPreferences(userId);
				if (preferences && preferences.isActive) {
					console.log(
						`Loaded active preferences for user ${userId}: ${preferences.feedbackCount.total} feedback items`
					);
					return preferences;
				}
				console.log(`No active preferences for user ${userId} (need ${5} feedback items)`);
				return null;
			} catch (error) {
				console.error('Failed to load learned preferences:', error);
				return null;
			}
		});

		// Step 3: Get existing job IDs to avoid duplicates
		// Note: Using array instead of Set because Inngest serializes step results to JSON
		const existingJobIds = await step.run('get-existing-jobs', async () => {
			const { data, error } = await supabase
				.from('jobs')
				.select('external_id, source')
				.eq('user_id', userId);

			if (error) throw new Error(`Failed to get existing jobs: ${error.message}`);

			return data?.map((j) => `${j.source}:${j.external_id}`) || [];
		});

		// Step 4: Search jobs from all sources in parallel
		const searchResults = await step.run('search-all-sources', async () => {
			const searchParams = {
				roles: profile.preferred_roles || [],
				locations: profile.preferred_locations || [],
				skills: profile.skills || [],
				remotePreference: profile.remote_preference
			};

			const [adzunaJobs, museJobs, greenhouseJobs, leverJobs, remoteokJobs, weworkremotelyJobs, joobleJobs] = await Promise.all([
				searchAdzunaJobs(searchParams).catch((e) => {
					console.error('Adzuna search failed:', e);
					return [];
				}),
				searchMuseJobs(searchParams).catch((e) => {
					console.error('Muse search failed:', e);
					return [];
				}),
				searchGreenhouseJobs(searchParams).catch((e) => {
					console.error('Greenhouse search failed:', e);
					return [];
				}),
				searchLeverJobs(searchParams).catch((e) => {
					console.error('Lever search failed:', e);
					return [];
				}),
				// New sources - RemoteOK (no API key required)
				searchRemoteOKJobs(searchParams).catch((e) => {
					console.error('RemoteOK search failed:', e);
					return [];
				}),
				// WeWorkRemotely (RSS feed, no API key required)
				searchWeWorkRemotelyJobs(searchParams).catch((e) => {
					console.error('WeWorkRemotely search failed:', e);
					return [];
				}),
				// Jooble (requires JOOBLE_API_KEY - gracefully returns [] if not configured)
				searchJoobleJobs(searchParams).catch((e) => {
					console.error('Jooble search failed:', e);
					return [];
				})
			]);

			return {
				adzuna: adzunaJobs,
				muse: museJobs,
				greenhouse: greenhouseJobs,
				lever: leverJobs,
				remoteok: remoteokJobs,
				weworkremotely: weworkremotelyJobs,
				jooble: joobleJobs
			};
		});

		// Step 5: Filter out duplicates
		const uniqueJobs = await step.run('filter-duplicates', async () => {
			const allJobs = [
				...searchResults.adzuna,
				...searchResults.muse,
				...searchResults.greenhouse,
				...searchResults.lever,
				...searchResults.remoteok,
				...searchResults.weworkremotely,
				...searchResults.jooble
			];

			// Filter out jobs we've already seen
			return allJobs.filter(
				(job): job is NonNullable<typeof job> =>
					job !== null && !existingJobIds.includes(`${job.source}:${job.externalId}`)
			);
		});

		// Step 6: Generate embeddings for new jobs if profile has embedding
		const jobsWithEmbeddings = await step.run('generate-job-embeddings', async () => {
			// Cast to proper type after Inngest JSON serialization
			const jobs = uniqueJobs as unknown as JobResult[];

			if (!hasEmbedding || jobs.length === 0) {
				// Return jobs without embeddings - will use keyword matching
				return jobs.map((job): JobWithEmbedding => ({
					...job,
					embedding: null
				}));
			}

			// Generate embeddings for jobs in parallel with error handling
			const jobsWithEmbeddingsResult = await Promise.all(
				jobs.map(async (job): Promise<JobWithEmbedding> => {
					try {
						const jobInput: JobEmbeddingInput = {
							title: job.title,
							company: job.company,
							description: job.description || null,
							requirements: job.requirements || null,
							location: job.location || null,
							employmentType: job.employmentType || null,
							experienceLevel: job.experienceLevel || null
						};

						const jobText = buildJobText(jobInput);
						if (jobText.trim().length >= 10) {
							const result = await generateEmbedding(jobText);
							return {
								...job,
								embedding: result.embedding
							};
						}
					} catch (error) {
						console.error(`Failed to generate embedding for job ${job.title}:`, error);
					}
					return {
						...job,
						embedding: null
					};
				})
			);

			return jobsWithEmbeddingsResult;
		});

		// Step 7: Score and rank jobs using embeddings or keywords
		const scoredJobs = await step.run('score-jobs', async () => {
			// Cast to proper type after Inngest JSON serialization
			const jobs = jobsWithEmbeddings as unknown as JobWithEmbedding[];

			if (jobs.length === 0) {
				return [] as ScoredJob[];
			}

			// Use embedding-based scoring when available
			const jobsToScore = jobs.map((job) => ({
				id: `${job.source}:${job.externalId}`,
				title: job.title,
				company: job.company,
				description: job.description || null,
				requirements: job.requirements || null,
				location: job.location || null,
				isRemote: job.isRemote,
				embedding: job.embedding
			}));

			const scores = await scoreJobsWithEmbeddings(jobsToScore, {
				userId,
				skills: profile.skills || [],
				preferredRoles: profile.preferred_roles || [],
				remotePreference: profile.remote_preference,
				embedding: profileEmbedding
			});

			// Create a map of scores
			const scoreMap = new Map(scores.map((s) => [s.id, s]));

			// Attach scores to jobs and apply learned preferences if available
			const jobsWithScores: ScoredJob[] = jobs.map((job) => {
				const scoreInfo = scoreMap.get(`${job.source}:${job.externalId}`);
				const baseScore = scoreInfo?.matchScore || 0;
				let matchReasons = scoreInfo?.matchReasons || [];

				// Apply learned preferences adjustment if active
				let finalScore = baseScore;
				let learningAdjustment = 0;
				if (learnedPreferences && learnedPreferences.isActive) {
					const preferenceResult = applyPreferencesToScore(
						{
							title: job.title,
							company: job.company,
							location: job.location || null,
							isRemote: job.isRemote,
							employmentType: job.employmentType || null,
							experienceLevel: job.experienceLevel || null,
							salaryMin: job.salaryMin || null,
							salaryMax: job.salaryMax || null,
							requirements: job.requirements || [],
							matchScore: baseScore
						},
						learnedPreferences
					);

					finalScore = preferenceResult.adjustedScore;
					learningAdjustment = finalScore - baseScore;

					// Add learning-based reasons to match reasons
					if (preferenceResult.reasons.length > 0) {
						matchReasons = [...matchReasons, ...preferenceResult.reasons];
					}
				}

				return {
					...job,
					matchScore: finalScore,
					baseMatchScore: baseScore,
					learningAdjustment,
					matchReasons,
					usedEmbedding: scoreInfo?.usedEmbedding || false,
					usedLearning: learnedPreferences?.isActive || false
				};
			});

			// Filter by threshold and sort by adjusted score
			return jobsWithScores
				.filter((job) => {
					// Apply threshold only for embedding-based scoring
					if (job.usedEmbedding) {
						return job.matchScore >= EMBEDDING_MATCH_THRESHOLD;
					}
					// For keyword-only, include all jobs but they'll be sorted by score
					return true;
				})
				.sort((a, b) => b.matchScore - a.matchScore)
				.slice(0, 20); // Take top 20
		});

		// Step 8: Save new jobs to database with embeddings
		const savedJobs = await step.run('save-jobs', async () => {
			// Cast to proper type after Inngest JSON serialization
			const jobs = scoredJobs as unknown as ScoredJob[];

			if (jobs.length === 0) {
				return { saved: 0, jobs: [] as Array<{ id: string }>, embeddingsStored: 0 };
			}

			const jobsToInsert = jobs.map((job) => ({
				user_id: userId,
				external_id: job.externalId,
				source: job.source,
				source_url: job.sourceUrl,
				title: job.title,
				company: job.company,
				company_logo: job.companyLogo,
				location: job.location,
				is_remote: job.isRemote,
				description: job.description,
				requirements: job.requirements,
				salary_min: job.salaryMin,
				salary_max: job.salaryMax,
				salary_currency: job.salaryCurrency,
				employment_type: job.employmentType,
				experience_level: job.experienceLevel,
				match_score: job.matchScore,
				match_reasons: job.matchReasons,
				embedding: job.embedding, // Store embedding if available
				posted_at: job.postedAt,
				status: 'pending'
			}));

			const { data, error } = await supabase.from('jobs').insert(jobsToInsert).select('id');

			if (error) throw new Error(`Failed to save jobs: ${error.message}`);

			const embeddingsStored = jobs.filter((j) => j.embedding !== null).length;

			return {
				saved: data?.length || 0,
				jobs: (data || []) as Array<{ id: string }>,
				embeddingsStored
			};
		});

		// Step 9: Queue resume generation for each new job (respecting usage limits)
		const generationResults = await step.run('queue-resume-generation', async () => {
			const results = {
				queued: 0,
				skippedLimitReached: 0,
				failed: 0
			};

			// Check current usage to determine how many we can generate
			const usageCheck = await usageService.checkUsageLimit(userId);

			// Calculate how many generations are available
			const availableGenerations = usageCheck.isUnlimited
				? savedJobs.jobs.length // Unlimited tier can generate all
				: Math.min(usageCheck.remaining, savedJobs.jobs.length);

			for (let i = 0; i < savedJobs.jobs.length; i++) {
				const job = savedJobs.jobs[i];

				// Determine status based on whether we're within limits
				const withinLimit = i < availableGenerations;
				const status = withinLimit ? 'generating' : 'pending_upgrade';

				// Create job application record
				const { data: application, error } = await supabase
					.from('job_applications')
					.insert({
						user_id: userId,
						job_id: job.id,
						status,
						error_message: withinLimit
							? null
							: `Generation limit reached. Upgrade your plan for more generations.`
					})
					.select('id')
					.single();

				if (error) {
					console.error(`Failed to create application for job ${job.id}:`, error);
					results.failed++;
					continue;
				}

				// Only queue generation if within limit
				if (withinLimit) {
					await inngest.send({
						name: 'resume/generation.requested',
						data: {
							userId,
							jobId: job.id,
							applicationId: application.id
						}
					});
					results.queued++;
				} else {
					results.skippedLimitReached++;
				}
			}

			return results;
		});

		// Step 10: Log search history
		await step.run('log-search-history', async () => {
			await supabase.from('search_history').insert({
				user_id: userId,
				query: profile.preferred_roles?.join(', ') || 'general',
				filters: {
					roles: profile.preferred_roles,
					locations: profile.preferred_locations,
					remote: profile.remote_preference,
					usedEmbeddings: hasEmbedding,
					usedLearning: learnedPreferences?.isActive || false,
					learningFeedbackCount: learnedPreferences?.feedbackCount.total || 0
				},
				source: 'daily_discovery',
				jobs_found:
					searchResults.adzuna.length +
					searchResults.muse.length +
					searchResults.greenhouse.length +
					searchResults.lever.length +
					searchResults.remoteok.length +
					searchResults.weworkremotely.length +
					searchResults.jooble.length,
				jobs_new: uniqueJobs.length,
				jobs_matched: savedJobs.saved
			});
		});

		// Step 11: Send job matches email notification
		const emailResult = await step.run('send-job-matches-email', async () => {
			// Check if user wants to receive job match emails
			const emailPrefs = parseEmailPreferences(profile.email_preferences);
			if (!shouldSendEmail(emailPrefs, 'jobMatches')) {
				return { sent: false, reason: 'user_opted_out' };
			}

			// Only send if we found new jobs
			if (savedJobs.saved === 0) {
				return { sent: false, reason: 'no_new_jobs' };
			}

			// Get full job details for the email
			const { data: jobDetails } = await supabase
				.from('jobs')
				.select('id, title, company, location, is_remote, match_score, salary_min, salary_max, salary_currency, source_url')
				.in('id', savedJobs.jobs.map(j => j.id))
				.order('match_score', { ascending: false });

			if (!jobDetails || jobDetails.length === 0) {
				return { sent: false, reason: 'no_job_details' };
			}

			// Map to email-compatible format
			const jobMatches: JobMatch[] = jobDetails.map(job => ({
				id: job.id,
				title: job.title,
				company: job.company,
				location: job.location,
				isRemote: job.is_remote || false,
				matchScore: job.match_score,
				salaryMin: job.salary_min,
				salaryMax: job.salary_max,
				salaryCurrency: job.salary_currency || 'USD',
				sourceUrl: job.source_url
			}));

			try {
				const result = await sendJobMatchesDigest(
					profile.email,
					userId,
					profile.full_name || '',
					jobMatches,
					savedJobs.saved
				);

				// Log email send to history
				await supabase.from('email_send_history').insert({
					user_id: userId,
					email_type: 'job_matches',
					recipient_email: profile.email,
					subject: `${savedJobs.saved} New Job Match${savedJobs.saved !== 1 ? 'es' : ''} Found`,
					message_id: result.messageId,
					status: result.success ? 'sent' : 'failed',
					error_message: result.error,
					metadata: {
						jobCount: savedJobs.saved,
						topJobId: jobMatches[0]?.id
					}
				});

				return {
					sent: result.success,
					messageId: result.messageId,
					error: result.error
				};
			} catch (error) {
				console.error('Failed to send job matches email:', error);
				return { sent: false, reason: 'email_error', error: (error as Error).message };
			}
		});

		// Calculate learning statistics for return value
		const learningStats = learnedPreferences
			? {
					isActive: learnedPreferences.isActive,
					feedbackCount: learnedPreferences.feedbackCount.total,
					jobsAdjusted: scoredJobs.filter((j) => j.learningAdjustment !== 0).length,
					avgAdjustment:
						scoredJobs.length > 0
							? Math.round(
									scoredJobs.reduce((sum, j) => sum + j.learningAdjustment, 0) / scoredJobs.length
								)
							: 0
				}
			: {
					isActive: false,
					feedbackCount: 0,
					jobsAdjusted: 0,
					avgAdjustment: 0
				};

		return {
			totalFound:
				searchResults.adzuna.length +
				searchResults.muse.length +
				searchResults.greenhouse.length +
				searchResults.lever.length +
				searchResults.remoteok.length +
				searchResults.weworkremotely.length +
				searchResults.jooble.length,
			bySource: {
				adzuna: searchResults.adzuna.length,
				muse: searchResults.muse.length,
				greenhouse: searchResults.greenhouse.length,
				lever: searchResults.lever.length,
				remoteok: searchResults.remoteok.length,
				weworkremotely: searchResults.weworkremotely.length,
				jooble: searchResults.jooble.length
			},
			newJobs: uniqueJobs.length,
			savedJobs: savedJobs.saved,
			embeddingsGenerated: savedJobs.embeddingsStored,
			usedEmbeddingMatching: hasEmbedding,
			usedLearning: learningStats.isActive,
			learningStats,
			generationsQueued: generationResults.queued,
			generationsSkipped: generationResults.skippedLimitReached,
			emailSent: emailResult.sent
		};
	}
);

// Trigger daily discovery for all users (scheduler)
export const scheduleDailyDiscovery = inngest.createFunction(
	{
		id: 'schedule-daily-discovery',
		name: 'Schedule Daily Discovery'
	},
	{ cron: '0 6 * * *' }, // Run at 6 AM UTC daily
	async ({ step }) => {
		const supabase = createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});

		// Get all active users
		const users = await step.run('get-active-users', async () => {
			const { data, error } = await supabase.from('profiles').select('user_id');

			if (error) throw new Error(`Failed to get users: ${error.message}`);
			return data || [];
		});

		// Send discovery event for each user
		await step.run('send-discovery-events', async () => {
			for (const user of users) {
				await inngest.send({
					name: 'job/discovery.requested',
					data: { userId: user.user_id }
				});
			}
		});

		return { usersScheduled: users.length };
	}
);
