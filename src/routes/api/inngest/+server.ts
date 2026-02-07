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

/**
 * Custom Inngest handler for SvelteKit on Cloudflare Pages
 *
 * The issue: The inngest/sveltekit adapter uses event.request.url which on
 * Cloudflare Pages may not include query parameters correctly.
 *
 * The fix: Use the inngest/cloudflare adapter with a custom Request that has
 * the full URL from SvelteKit's event.url (which always has query params).
 *
 * Note: Event key is handled via the Inngest client constructor or the
 * INNGEST_EVENT_KEY environment variable - it's not a serve() option.
 */
function getHandler() {
	return serve({
		client: inngest,
		functions,
		signingKey: env.INNGEST_SIGNING_KEY,
		servePath: '/api/inngest',
		// Enable streaming to extend request timeouts on Cloudflare Workers/Pages
		// This allows Inngest to use HTTP streaming for long-running step executions
		// and can extend effective timeout from ~30s to ~15 minutes
		streaming: 'allow'
	});
}

/**
 * Creates a new Request with the full URL from SvelteKit's event.url
 * This ensures query parameters (like fnId) are preserved
 */
function createRequestWithFullUrl(event: Parameters<RequestHandler>[0]): Request {
	const { request, url } = event;

	// SvelteKit's event.url always has the full URL with query params
	// Create a new Request with this full URL
	return new Request(url.href, {
		method: request.method,
		headers: request.headers,
		body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
		// @ts-expect-error - duplex is needed for streaming bodies
		duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined
	});
}

// Type for Cloudflare Pages Functions format (object with request and env)
type CloudflarePagesContext = { request: Request; env: Record<string, string | undefined> };
type CloudflareHandler = (ctx: CloudflarePagesContext) => Promise<Response>;

/**
 * Create environment object with actual Cloudflare Pages environment variables
 * This is required for Inngest to function properly on Pages
 */
function getCloudflareEnv(): Record<string, string | undefined> {
	// Cloudflare Pages environment variables are available via the dynamic import
	// Include any env vars that Inngest functions might need
	return {
		INNGEST_SIGNING_KEY: env.INNGEST_SIGNING_KEY,
		INNGEST_EVENT_KEY: env.INNGEST_EVENT_KEY,
		PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
		SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
		CLOUDFLARE_AI_GATEWAY_URL: env.CLOUDFLARE_AI_GATEWAY_URL,
		// Add other env vars as needed by your functions
	};
}

/**
 * Error handler that returns proper JSON response instead of HTML
 * Prevents Inngest from receiving HTML 500 error pages
 */
function handleError(error: unknown): Response {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	console.error('Inngest handler error:', {
		message: errorMessage,
		stack: errorStack,
		timestamp: new Date().toISOString()
	});

	return new Response(
		JSON.stringify({
			error: 'Internal Server Error',
			message: errorMessage,
			status: 500
		}),
		{
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);
}

// Export the handlers using the Cloudflare adapter pattern
// Pass as Pages Functions format: { request, env }
export const GET: RequestHandler = async (event) => {
	try {
		const handler = getHandler() as unknown as CloudflareHandler;
		const requestWithUrl = createRequestWithFullUrl(event);
		const cfEnv = getCloudflareEnv();
		const response = await handler({ request: requestWithUrl, env: cfEnv });
		return response;
	} catch (error) {
		return handleError(error);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const handler = getHandler() as unknown as CloudflareHandler;
		const requestWithUrl = createRequestWithFullUrl(event);
		const cfEnv = getCloudflareEnv();
		const response = await handler({ request: requestWithUrl, env: cfEnv });
		return response;
	} catch (error) {
		return handleError(error);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const handler = getHandler() as unknown as CloudflareHandler;
		const requestWithUrl = createRequestWithFullUrl(event);
		const cfEnv = getCloudflareEnv();
		const response = await handler({ request: requestWithUrl, env: cfEnv });
		return response;
	} catch (error) {
		return handleError(error);
	}
};
