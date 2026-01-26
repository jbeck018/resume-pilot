import { serve } from 'inngest/sveltekit';
import { env } from '$env/dynamic/private';
import {
	inngest,
	dailyJobDiscovery,
	scheduleDailyDiscovery,
	generateResumeForJob,
	parseResumeFile,
	sendWeeklySummaries
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
		sendWeeklySummaries
	],
	signingKey: env.INNGEST_SIGNING_KEY
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
