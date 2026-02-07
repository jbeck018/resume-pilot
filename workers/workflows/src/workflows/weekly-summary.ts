// Weekly Summary Workflow
// Sends weekly summary emails to users who opted in
// Triggered by cron: Every Monday at 9 AM UTC

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, WeeklySummaryParams, WeeklySummaryResult } from '../types';
import { createSupabaseClient } from '../utils/supabase';

interface EmailPreferences {
	weeklySummary?: boolean;
	resumeReady?: boolean;
	newMatches?: boolean;
}

export class WeeklySummaryWorkflow extends WorkflowEntrypoint<Env, WeeklySummaryParams> {
	async run(
		event: WorkflowEvent<WeeklySummaryParams>,
		step: WorkflowStep
	): Promise<WeeklySummaryResult> {
		// Calculate week boundaries
		const now = new Date();
		const lastMonday = new Date(now);
		lastMonday.setDate(now.getDate() - 7 - ((now.getDay() + 6) % 7));
		lastMonday.setHours(0, 0, 0, 0);

		const lastSunday = new Date(lastMonday);
		lastSunday.setDate(lastMonday.getDate() + 6);
		lastSunday.setHours(23, 59, 59, 999);

		try {
			// Step 1: Get users who want weekly summaries
			const users = await step.do('get-users', async () => {
				const supabase = createSupabaseClient(this.env);
				const { data, error } = await supabase
					.from('profiles')
					.select('user_id, email, full_name, email_preferences');

				if (error) throw new Error(`Failed to get users: ${error.message}`);

				// Filter users who want weekly summaries
				return (data || []).filter(user => {
					const prefs = this.parseEmailPreferences(user.email_preferences);
					return prefs.weeklySummary !== false; // Default to true
				});
			});

			if (users.length === 0) {
				return {
					success: true,
					totalUsers: 0,
					sent: 0,
					failed: 0,
					skipped: 0
				};
			}

			// Step 2: Send emails to each user
			const results = await step.do('send-emails', async () => {
				const supabase = createSupabaseClient(this.env);
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
								.select('id, title, company, match_score')
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

						// Get top match job
						const topJob = jobsResult.data?.[0];

						// Send email via Resend
						if (this.env.RESEND_API_KEY) {
							const emailSent = await this.sendEmail(user, {
								jobsDiscovered,
								resumesGenerated,
								applicationsSubmitted,
								topJob
							});

							if (emailSent) {
								sent.push(user.user_id);

								// Log to email history
								await supabase.from('email_send_history').insert({
									user_id: user.user_id,
									email_type: 'weekly_summary',
									recipient_email: user.email,
									subject: 'Your Weekly Job Search Summary',
									status: 'sent',
									metadata: {
										weekStart: lastMonday.toISOString(),
										weekEnd: lastSunday.toISOString(),
										stats: { jobsDiscovered, resumesGenerated, applicationsSubmitted }
									}
								});
							} else {
								failed.push(user.user_id);
							}
						} else {
							skipped.push(user.user_id);
						}
					} catch (error) {
						console.error(`Failed for user ${user.user_id}:`, error);
						failed.push(user.user_id);
					}
				}

				return { sent, failed, skipped };
			});

			return {
				success: true,
				totalUsers: users.length,
				sent: results.sent.length,
				failed: results.failed.length,
				skipped: results.skipped.length
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	private parseEmailPreferences(prefs: unknown): EmailPreferences {
		if (!prefs || typeof prefs !== 'object') {
			return { weeklySummary: true, resumeReady: true, newMatches: true };
		}
		return prefs as EmailPreferences;
	}

	private async sendEmail(
		user: { email: string; full_name?: string },
		stats: {
			jobsDiscovered: number;
			resumesGenerated: number;
			applicationsSubmitted: number;
			topJob?: { title: string; company: string; match_score: number };
		}
	): Promise<boolean> {
		try {
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: 'HowlerHire <noreply@howlerhire.com>',
					to: user.email,
					subject: 'Your Weekly Job Search Summary',
					html: this.buildEmailHtml(user, stats)
				})
			});

			return response.ok;
		} catch (error) {
			console.error('Email send failed:', error);
			return false;
		}
	}

	private buildEmailHtml(
		user: { full_name?: string },
		stats: {
			jobsDiscovered: number;
			resumesGenerated: number;
			applicationsSubmitted: number;
			topJob?: { title: string; company: string; match_score: number };
		}
	): string {
		const name = user.full_name || 'there';
		const topJobSection = stats.topJob
			? `
			<div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
				<strong>Top Match This Week:</strong><br>
				${stats.topJob.title} at ${stats.topJob.company}<br>
				<span style="color: #059669;">Match Score: ${stats.topJob.match_score}%</span>
			</div>
		`
			: '';

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.stat { display: inline-block; text-align: center; padding: 16px; margin: 8px; background: #f3f4f6; border-radius: 8px; }
					.stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
					.stat-label { font-size: 14px; color: #6b7280; }
				</style>
			</head>
			<body>
				<div class="container">
					<h1>Weekly Job Search Summary</h1>
					<p>Hey ${name}! Here's what happened with your job search this week:</p>

					<div style="text-align: center; margin: 24px 0;">
						<div class="stat">
							<div class="stat-value">${stats.jobsDiscovered}</div>
							<div class="stat-label">Jobs Discovered</div>
						</div>
						<div class="stat">
							<div class="stat-value">${stats.resumesGenerated}</div>
							<div class="stat-label">Resumes Generated</div>
						</div>
						<div class="stat">
							<div class="stat-value">${stats.applicationsSubmitted}</div>
							<div class="stat-label">Applications Submitted</div>
						</div>
					</div>

					${topJobSection}

					<p>Keep up the momentum! Your next opportunity could be just around the corner.</p>

					<p style="margin-top: 32px;">
						<a href="https://howlerhire.com/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
							View Dashboard
						</a>
					</p>

					<p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
						You're receiving this because you have weekly summaries enabled.
						<a href="https://howlerhire.com/dashboard/settings">Manage preferences</a>
					</p>
				</div>
			</body>
			</html>
		`;
	}
}
