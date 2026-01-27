import { Inngest } from 'inngest';
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
 */
function getHandler() {
	return serve({
		client: inngest,
		functions,
		signingKey: env.INNGEST_SIGNING_KEY,
		servePath: '/api/inngest'
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

// Type for calling the Cloudflare handler with positional args
type CloudflareHandler = (req: Request, env: Record<string, string | undefined>) => Promise<Response>;

// Export the handlers using the Cloudflare adapter pattern
// but with SvelteKit's properly-parsed URL
export const GET: RequestHandler = async (event) => {
	const handler = getHandler() as unknown as CloudflareHandler;
	const requestWithUrl = createRequestWithFullUrl(event);

	// Log for debugging (can remove once confirmed working)
	console.log('[Inngest GET] URL:', event.url.href);
	console.log('[Inngest GET] fnId:', event.url.searchParams.get('fnId'));

	return handler(requestWithUrl, {});
};

export const POST: RequestHandler = async (event) => {
	const handler = getHandler() as unknown as CloudflareHandler;
	const requestWithUrl = createRequestWithFullUrl(event);

	console.log('[Inngest POST] URL:', event.url.href);
	console.log('[Inngest POST] fnId:', event.url.searchParams.get('fnId'));

	return handler(requestWithUrl, {});
};

export const PUT: RequestHandler = async (event) => {
	const handler = getHandler() as unknown as CloudflareHandler;
	const requestWithUrl = createRequestWithFullUrl(event);

	console.log('[Inngest PUT] URL:', event.url.href);
	console.log('[Inngest PUT] fnId:', event.url.searchParams.get('fnId'));

	return handler(requestWithUrl, {});
};
