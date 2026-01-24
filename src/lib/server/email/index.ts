// Email service for Resume Pilot using Resend API
// Handles all email notifications with retry logic and error handling

import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Get API key from dynamic env (with fallback for dev)
const RESEND_API_KEY = env.RESEND_API_KEY || '';
import {
	welcomeEmail,
	jobMatchesDigestEmail,
	resumeReadyEmail,
	weeklySummaryEmail,
	applicationStatusEmail,
	type WelcomeEmailData,
	type JobMatchesDigestData,
	type ResumeReadyData,
	type WeeklySummaryData,
	type ApplicationStatusData,
	type JobMatch
} from './templates';

// Initialize Resend client (lazy initialization to avoid errors when API key not set)
let _resend: Resend | null = null;
function getResendClient(): Resend {
	if (!RESEND_API_KEY) {
		throw new EmailError('RESEND_API_KEY is not configured', 'missing_api_key', false);
	}
	if (!_resend) {
		_resend = new Resend(RESEND_API_KEY);
	}
	return _resend;
}

// Email configuration
const FROM_EMAIL = 'Resume Pilot <notifications@resumepilot.app>';
const REPLY_TO = 'support@resumepilot.app';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Types for email preferences
export interface EmailPreferences {
	jobMatches: boolean;
	resumeReady: boolean;
	weeklySummary: boolean;
	applicationUpdates: boolean;
	marketingEmails: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
	jobMatches: true,
	resumeReady: true,
	weeklySummary: true,
	applicationUpdates: true,
	marketingEmails: false
};

// Error types
export class EmailError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly retryable: boolean = false
	) {
		super(message);
		this.name = 'EmailError';
	}
}

// Result type for email operations
export interface EmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

// Helper to generate unsubscribe URL
function getUnsubscribeUrl(userId: string): string {
	return `${publicEnv.PUBLIC_APP_URL}/dashboard/profile?tab=notifications&userId=${userId}`;
}

// Helper to sleep for retry delays
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Core send function with retry logic
async function sendEmailWithRetry(
	to: string,
	subject: string,
	html: string,
	tags?: { name: string; value: string }[]
): Promise<EmailResult> {
	let lastError: Error | null = null;

	// Get resend client (will throw if not configured)
	let resend: Resend;
	try {
		resend = getResendClient();
	} catch (error) {
		return {
			success: false,
			error: (error as Error).message
		};
	}

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const result = await resend.emails.send({
				from: FROM_EMAIL,
				to,
				subject,
				html,
				replyTo: REPLY_TO,
				tags
			});

			if (result.error) {
				throw new EmailError(result.error.message, result.error.name, true);
			}

			return {
				success: true,
				messageId: result.data?.id
			};
		} catch (error) {
			lastError = error as Error;

			// Don't retry on non-retryable errors
			if (error instanceof EmailError && !error.retryable) {
				break;
			}

			// Don't retry on the last attempt
			if (attempt < MAX_RETRIES) {
				console.warn(`Email send attempt ${attempt} failed, retrying...`, error);
				await sleep(RETRY_DELAY_MS * attempt);
			}
		}
	}

	console.error('Email send failed after all retries:', lastError);
	return {
		success: false,
		error: lastError?.message || 'Unknown error'
	};
}

// ============================================================================
// Email Service Functions
// ============================================================================

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
	to: string,
	userId: string,
	userName?: string
): Promise<EmailResult> {
	const data: WelcomeEmailData = {
		userName: userName || '',
		dashboardUrl: `${publicEnv.PUBLIC_APP_URL}/dashboard`,
		unsubscribeUrl: getUnsubscribeUrl(userId)
	};

	const html = welcomeEmail(data);

	return sendEmailWithRetry(to, 'Welcome to Resume Pilot!', html, [
		{ name: 'category', value: 'welcome' },
		{ name: 'userId', value: userId }
	]);
}

/**
 * Send job matches digest email
 */
export async function sendJobMatchesDigest(
	to: string,
	userId: string,
	userName: string,
	jobs: JobMatch[],
	totalNewJobs: number
): Promise<EmailResult> {
	if (jobs.length === 0) {
		return { success: true }; // No jobs to send
	}

	const data: JobMatchesDigestData = {
		userName,
		jobs,
		totalNewJobs,
		dashboardUrl: `${publicEnv.PUBLIC_APP_URL}/dashboard`,
		unsubscribeUrl: getUnsubscribeUrl(userId)
	};

	const html = jobMatchesDigestEmail(data);

	return sendEmailWithRetry(
		to,
		`${totalNewJobs} New Job Match${totalNewJobs !== 1 ? 'es' : ''} Found`,
		html,
		[
			{ name: 'category', value: 'job_matches' },
			{ name: 'userId', value: userId }
		]
	);
}

/**
 * Send resume ready notification email
 */
export async function sendResumeReadyEmail(
	to: string,
	userId: string,
	userName: string,
	jobId: string,
	jobTitle: string,
	company: string,
	matchScore: number | null,
	atsScore: number | null
): Promise<EmailResult> {
	const data: ResumeReadyData = {
		userName,
		jobTitle,
		company,
		matchScore,
		atsScore,
		applicationUrl: `${publicEnv.PUBLIC_APP_URL}/dashboard/jobs/${jobId}`,
		unsubscribeUrl: getUnsubscribeUrl(userId)
	};

	const html = resumeReadyEmail(data);

	return sendEmailWithRetry(to, `Your Resume for ${company} is Ready!`, html, [
		{ name: 'category', value: 'resume_ready' },
		{ name: 'userId', value: userId },
		{ name: 'jobId', value: jobId }
	]);
}

/**
 * Send weekly summary email
 */
export async function sendWeeklySummaryEmail(
	to: string,
	userId: string,
	userName: string,
	stats: WeeklySummaryData['stats'],
	weekStartDate: Date
): Promise<EmailResult> {
	const formattedDate = weekStartDate.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});

	const data: WeeklySummaryData = {
		userName,
		weekStartDate: formattedDate,
		stats,
		dashboardUrl: `${publicEnv.PUBLIC_APP_URL}/dashboard`,
		unsubscribeUrl: getUnsubscribeUrl(userId)
	};

	const html = weeklySummaryEmail(data);

	return sendEmailWithRetry(to, 'Your Weekly Job Search Summary', html, [
		{ name: 'category', value: 'weekly_summary' },
		{ name: 'userId', value: userId }
	]);
}

/**
 * Send application status change email
 */
export async function sendApplicationStatusEmail(
	to: string,
	userId: string,
	userName: string,
	jobId: string,
	jobTitle: string,
	company: string,
	oldStatus: string,
	newStatus: string
): Promise<EmailResult> {
	const data: ApplicationStatusData = {
		userName,
		jobTitle,
		company,
		oldStatus,
		newStatus,
		applicationUrl: `${publicEnv.PUBLIC_APP_URL}/dashboard/jobs/${jobId}`,
		unsubscribeUrl: getUnsubscribeUrl(userId)
	};

	const html = applicationStatusEmail(data);

	// Format status for subject line
	const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace(/_/g, ' ');

	return sendEmailWithRetry(to, `Application Update: ${statusLabel} - ${company}`, html, [
		{ name: 'category', value: 'application_status' },
		{ name: 'userId', value: userId },
		{ name: 'jobId', value: jobId }
	]);
}

// ============================================================================
// Email Preference Helpers
// ============================================================================

/**
 * Check if a user should receive a specific email type
 */
export function shouldSendEmail(
	preferences: EmailPreferences | null | undefined,
	emailType: keyof EmailPreferences
): boolean {
	// If no preferences set, use defaults
	if (!preferences) {
		return DEFAULT_EMAIL_PREFERENCES[emailType];
	}

	// Check specific preference
	return preferences[emailType] ?? DEFAULT_EMAIL_PREFERENCES[emailType];
}

/**
 * Parse email preferences from database JSON
 */
export function parseEmailPreferences(
	dbValue: unknown
): EmailPreferences {
	if (!dbValue || typeof dbValue !== 'object') {
		return { ...DEFAULT_EMAIL_PREFERENCES };
	}

	const prefs = dbValue as Record<string, unknown>;

	return {
		jobMatches: typeof prefs.jobMatches === 'boolean' ? prefs.jobMatches : DEFAULT_EMAIL_PREFERENCES.jobMatches,
		resumeReady: typeof prefs.resumeReady === 'boolean' ? prefs.resumeReady : DEFAULT_EMAIL_PREFERENCES.resumeReady,
		weeklySummary: typeof prefs.weeklySummary === 'boolean' ? prefs.weeklySummary : DEFAULT_EMAIL_PREFERENCES.weeklySummary,
		applicationUpdates: typeof prefs.applicationUpdates === 'boolean' ? prefs.applicationUpdates : DEFAULT_EMAIL_PREFERENCES.applicationUpdates,
		marketingEmails: typeof prefs.marketingEmails === 'boolean' ? prefs.marketingEmails : DEFAULT_EMAIL_PREFERENCES.marketingEmails
	};
}

// ============================================================================
// Batch Email Operations
// ============================================================================

export interface BatchEmailRecipient {
	email: string;
	userId: string;
	userName: string;
	data: Record<string, unknown>;
}

/**
 * Send batch emails (for weekly summaries, etc.)
 * Uses Resend's batch API for efficiency
 */
export async function sendBatchEmails(
	recipients: BatchEmailRecipient[],
	generateHtml: (recipient: BatchEmailRecipient) => string,
	subject: string | ((recipient: BatchEmailRecipient) => string),
	category: string
): Promise<{ successful: number; failed: number; errors: string[] }> {
	const results = {
		successful: 0,
		failed: 0,
		errors: [] as string[]
	};

	// Process in batches of 100 (Resend limit)
	const BATCH_SIZE = 100;

	for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
		const batch = recipients.slice(i, i + BATCH_SIZE);

		const emails = batch.map((recipient) => ({
			from: FROM_EMAIL,
			to: recipient.email,
			subject: typeof subject === 'function' ? subject(recipient) : subject,
			html: generateHtml(recipient),
			replyTo: REPLY_TO,
			tags: [
				{ name: 'category', value: category },
				{ name: 'userId', value: recipient.userId }
			]
		}));

		try {
			const resend = getResendClient();
			const response = await resend.batch.send(emails);

			if (response.error) {
				results.failed += batch.length;
				results.errors.push(response.error.message);
			} else {
				results.successful += batch.length;
			}
		} catch (error) {
			results.failed += batch.length;
			results.errors.push((error as Error).message);
		}

		// Rate limiting - wait between batches
		if (i + BATCH_SIZE < recipients.length) {
			await sleep(100);
		}
	}

	return results;
}

// Re-export types for convenience
export type { JobMatch } from './templates';
