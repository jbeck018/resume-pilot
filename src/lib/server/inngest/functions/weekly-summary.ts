import { inngest } from '../client';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import {
	sendWeeklySummaryEmail,
	shouldSendEmail,
	parseEmailPreferences,
	type JobMatch
} from '$lib/server/email';

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

// Weekly summary email workflow - sends every Monday at 9 AM UTC
export const sendWeeklySummaries = inngest.createFunction(
	{
		id: 'send-weekly-summaries',
		name: 'Send Weekly Summary Emails'
	},
	{ cron: '0 9 * * 1' }, // Every Monday at 9 AM UTC
	async ({ step }) => {
		// NOTE: Supabase client is now created INSIDE each step to avoid
		// CPU overhead on every Inngest step invocation (fixes Cloudflare error 1102)

		// Calculate week boundaries (last Monday to Sunday)
		const now = new Date();
		const lastMonday = new Date(now);
		lastMonday.setDate(now.getDate() - 7 - ((now.getDay() + 6) % 7));
		lastMonday.setHours(0, 0, 0, 0);

		const lastSunday = new Date(lastMonday);
		lastSunday.setDate(lastMonday.getDate() + 6);
		lastSunday.setHours(23, 59, 59, 999);

		// Step 1: Get all users who want weekly summaries
		const users = await step.run('get-users-with-weekly-summary', async () => {
			const supabase = createSupabase();
			const { data, error } = await supabase
				.from('profiles')
				.select('user_id, email, full_name, email_preferences');

			if (error) throw new Error(`Failed to get users: ${error.message}`);

			// Filter users who want weekly summaries
			return (data || []).filter((user) => {
				const prefs = parseEmailPreferences(user.email_preferences);
				return shouldSendEmail(prefs, 'weeklySummary');
			});
		});

		// Step 2: Send summary email to each user
		const results = await step.run('send-summary-emails', async () => {
			const supabase = createSupabase();
			const sent: string[] = [];
			const failed: string[] = [];
			const skipped: string[] = [];

			for (const user of users) {
				try {
					// Get user's stats for the week
					const [jobsResult, applicationsResult, appliedResult] = await Promise.all([
						// Jobs discovered this week
						supabase
							.from('jobs')
							.select('id, title, company, location, is_remote, match_score, salary_min, salary_max, salary_currency, source_url')
							.eq('user_id', user.user_id)
							.gte('discovered_at', lastMonday.toISOString())
							.lte('discovered_at', lastSunday.toISOString())
							.order('match_score', { ascending: false }),

						// Resumes generated this week
						supabase
							.from('job_applications')
							.select('id')
							.eq('user_id', user.user_id)
							.eq('status', 'ready')
							.gte('created_at', lastMonday.toISOString())
							.lte('created_at', lastSunday.toISOString()),

						// Applications submitted this week
						supabase
							.from('jobs')
							.select('id')
							.eq('user_id', user.user_id)
							.eq('status', 'applied')
							.gte('applied_at', lastMonday.toISOString())
							.lte('applied_at', lastSunday.toISOString())
					]);

					const jobsDiscovered = jobsResult.data?.length || 0;
					const resumesGenerated = applicationsResult.data?.length || 0;
					const applicationsSubmitted = appliedResult.data?.length || 0;

					// Skip if no activity
					if (jobsDiscovered === 0 && resumesGenerated === 0 && applicationsSubmitted === 0) {
						skipped.push(user.user_id);
						continue;
					}

					// Get top match job for this week
					let topMatch: JobMatch | null = null;
					if (jobsResult.data && jobsResult.data.length > 0) {
						const top = jobsResult.data[0];
						topMatch = {
							id: top.id,
							title: top.title,
							company: top.company,
							location: top.location,
							isRemote: top.is_remote || false,
							matchScore: top.match_score,
							salaryMin: top.salary_min,
							salaryMax: top.salary_max,
							salaryCurrency: top.salary_currency || 'USD',
							sourceUrl: top.source_url
						};
					}

					// Send the email
					const emailResult = await sendWeeklySummaryEmail(
						user.email,
						user.user_id,
						user.full_name || '',
						{
							jobsDiscovered,
							resumesGenerated,
							applicationsSubmitted,
							topMatch
						},
						lastMonday
					);

					// Log email send to history
					await supabase.from('email_send_history').insert({
						user_id: user.user_id,
						email_type: 'weekly_summary',
						recipient_email: user.email,
						subject: 'Your Weekly Job Search Summary',
						message_id: emailResult.messageId,
						status: emailResult.success ? 'sent' : 'failed',
						error_message: emailResult.error,
						metadata: {
							weekStart: lastMonday.toISOString(),
							weekEnd: lastSunday.toISOString(),
							stats: {
								jobsDiscovered,
								resumesGenerated,
								applicationsSubmitted
							}
						}
					});

					if (emailResult.success) {
						sent.push(user.user_id);
					} else {
						failed.push(user.user_id);
					}
				} catch (error) {
					console.error(`Failed to send weekly summary to ${user.user_id}:`, error);
					failed.push(user.user_id);
				}
			}

			return { sent, failed, skipped };
		});

		return {
			totalUsers: users.length,
			sent: results.sent.length,
			failed: results.failed.length,
			skipped: results.skipped.length,
			weekStart: lastMonday.toISOString(),
			weekEnd: lastSunday.toISOString()
		};
	}
);
