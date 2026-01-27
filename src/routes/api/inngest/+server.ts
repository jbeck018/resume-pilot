import { serve } from 'inngest/sveltekit';
import { env } from '$env/dynamic/private';
import {
	inngest,
	dailyJobDiscovery,
	scheduleDailyDiscovery,
	generateResumeForJob,
	parseResumeFile,
	sendWeeklySummaries,
	syncProfileFromGitHub
} from '$lib/server/inngest';

// Serve the Inngest API endpoint
// Note: signingKey must be passed explicitly for Cloudflare Workers
// because process.env is not available
const handler = serve({
	client: inngest,
	functions: [
		dailyJobDiscovery,
		scheduleDailyDiscovery,
		generateResumeForJob,
		parseResumeFile,
		sendWeeklySummaries,
		syncProfileFromGitHub
	],
	// Signing key is required for production
	// If not set, Inngest will reject function execution requests
	signingKey: env.INNGEST_SIGNING_KEY || undefined
});

// Wrap handlers to ensure they work on Cloudflare Workers
export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
