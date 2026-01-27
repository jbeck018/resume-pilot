import { serve } from 'inngest/cloudflare';
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

// Use the Cloudflare adapter which properly handles Cloudflare Workers environment
function createHandler(platformEnv: Record<string, string | undefined> = {}) {
	// Merge SvelteKit's dynamic env with Cloudflare platform env
	// This ensures env vars are available both in local dev and production
	const mergedEnv: Record<string, string | undefined> = {
		...env,
		...platformEnv
	};

	return serve({
		client: inngest,
		functions,
		// Signing key from merged environment
		signingKey: mergedEnv.INNGEST_SIGNING_KEY
	});
}

// Helper to call handler - the Cloudflare adapter's Either type causes TS issues
// but runtime correctly handles both Pages ({request, env}) and Workers (request, env) formats
async function callHandler(
	handler: ReturnType<typeof createHandler>,
	request: Request,
	platformEnv: Record<string, string | undefined>
): Promise<Response> {
	// Use Pages format: single object with request and env
	// TypeScript's Either<A,B> intersection is impossible to satisfy statically
	// but the runtime deriveHandlerArgs() correctly handles this format
	const context = { request, env: platformEnv };
	return (handler as (ctx: typeof context) => Promise<Response>)(context);
}

// Wrap handlers for SvelteKit - convert RequestEvent to Cloudflare format
export const GET: RequestHandler = async (event) => {
	const platformEnv = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const handler = createHandler(platformEnv);
	return callHandler(handler, event.request, platformEnv);
};

export const POST: RequestHandler = async (event) => {
	const platformEnv = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const handler = createHandler(platformEnv);
	return callHandler(handler, event.request, platformEnv);
};

export const PUT: RequestHandler = async (event) => {
	const platformEnv = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const handler = createHandler(platformEnv);
	return callHandler(handler, event.request, platformEnv);
};
