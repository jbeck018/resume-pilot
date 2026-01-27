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

// Create the Inngest serve handler
// The SvelteKit adapter properly handles the RequestEvent and preserves query params
// signingKey is read at request time via $env/dynamic/private (Cloudflare compatible)
function getHandler() {
	return serve({
		client: inngest,
		functions,
		signingKey: env.INNGEST_SIGNING_KEY,
		servePath: '/api/inngest'
	});
}

// Export the handlers using SvelteKit's pattern
// The SvelteKit adapter provides GET, POST, PUT methods that accept RequestEvent
export const GET: RequestHandler = async (event) => {
	const handler = getHandler();
	return handler.GET(event);
};

export const POST: RequestHandler = async (event) => {
	const handler = getHandler();
	return handler.POST(event);
};

export const PUT: RequestHandler = async (event) => {
	const handler = getHandler();
	return handler.PUT(event);
};
