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
import type { RequestHandler } from './$types';

// Functions array - defined at module level since these don't need env vars
const functions = [
	dailyJobDiscovery,
	scheduleDailyDiscovery,
	generateResumeForJob,
	parseResumeFile,
	sendWeeklySummaries,
	syncProfileFromGitHub
];

// Create handler lazily at request time to ensure env vars are available
// This is required for Cloudflare Workers where env vars aren't available at module load
function createHandler() {
	return serve({
		client: inngest,
		functions,
		// Signing key is required for production
		// Read at request time when env vars are available
		signingKey: env.INNGEST_SIGNING_KEY || undefined
	});
}

// Wrap handlers to create them at request time
export const GET: RequestHandler = (event) => {
	const handler = createHandler();
	return handler.GET(event);
};

export const POST: RequestHandler = (event) => {
	const handler = createHandler();
	return handler.POST(event);
};

export const PUT: RequestHandler = (event) => {
	const handler = createHandler();
	return handler.PUT(event);
};
