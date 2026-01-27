import type { RequestHandler } from './$types';

/**
 * Debug endpoint to inspect what Cloudflare Pages actually receives
 * This mirrors /api/inngest but logs all request details
 */

function logRequestDetails(event: Parameters<RequestHandler>[0], method: string) {
	const { request, url, platform } = event;

	// Extract all headers into an object
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});

	// Parse URL details
	const urlDetails = {
		href: url.href,
		origin: url.origin,
		protocol: url.protocol,
		host: url.host,
		hostname: url.hostname,
		port: url.port,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash
	};

	// Extract query parameters
	const queryParams: Record<string, string> = {};
	url.searchParams.forEach((value, key) => {
		queryParams[key] = value;
	});

	// Check for fnId specifically (what Inngest SDK looks for)
	const fnId = url.searchParams.get('fnId');
	const stepId = url.searchParams.get('stepId');

	// Get raw request URL from the Request object itself
	const rawRequestUrl = request.url;

	// Check platform/env details
	const platformInfo = platform ? {
		hasPlatform: true,
		platformKeys: Object.keys(platform),
		// Cloudflare Pages specific
		cfEnv: platform.env ? 'present' : 'missing',
		cfContext: platform.context ? 'present' : 'missing'
	} : {
		hasPlatform: false
	};

	const debugInfo = {
		timestamp: new Date().toISOString(),
		method,
		url: {
			...urlDetails,
			rawRequestUrl,
			queryParams,
			queryString: url.search,
			searchParamsCount: url.searchParams.size
		},
		inngestParams: {
			fnId: fnId ?? 'NOT PRESENT',
			stepId: stepId ?? 'NOT PRESENT',
			hasFnId: fnId !== null,
			hasStepId: stepId !== null
		},
		headers: {
			all: headers,
			contentType: headers['content-type'] ?? 'NOT SET',
			userAgent: headers['user-agent'] ?? 'NOT SET',
			host: headers['host'] ?? 'NOT SET',
			cfRay: headers['cf-ray'] ?? 'NOT SET (not Cloudflare)',
			cfConnectingIp: headers['cf-connecting-ip'] ?? 'NOT SET',
			xForwardedFor: headers['x-forwarded-for'] ?? 'NOT SET',
			xForwardedProto: headers['x-forwarded-proto'] ?? 'NOT SET'
		},
		platform: platformInfo,
		analysis: {
			isCloudflare: !!headers['cf-ray'],
			urlHasQueryParams: url.search.length > 1,
			rawUrlHasQueryParams: rawRequestUrl.includes('?'),
			queryParamsMatch: url.search === (rawRequestUrl.includes('?') ? rawRequestUrl.split('?')[1] : '')
		}
	};

	// Log to console (will appear in Cloudflare logs)
	console.log('=== INNGEST DEBUG ===');
	console.log(JSON.stringify(debugInfo, null, 2));
	console.log('=== END DEBUG ===');

	return debugInfo;
}

export const GET: RequestHandler = async (event) => {
	const debugInfo = logRequestDetails(event, 'GET');

	return new Response(JSON.stringify(debugInfo, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const debugInfo = logRequestDetails(event, 'POST');

	// Also capture body for POST requests
	let body: unknown = null;
	let bodyError: string | null = null;

	try {
		const text = await request.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				body = text.substring(0, 1000); // Truncate if not JSON
			}
		}
	} catch (e) {
		bodyError = e instanceof Error ? e.message : 'Unknown error reading body';
	}

	const fullDebugInfo = {
		...debugInfo,
		body: {
			content: body,
			error: bodyError,
			hasBody: body !== null
		}
	};

	console.log('=== POST BODY ===');
	console.log(JSON.stringify(fullDebugInfo.body, null, 2));
	console.log('=== END POST BODY ===');

	return new Response(JSON.stringify(fullDebugInfo, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

export const PUT: RequestHandler = async (event) => {
	const { request } = event;
	const debugInfo = logRequestDetails(event, 'PUT');

	// Also capture body for PUT requests
	let body: unknown = null;
	let bodyError: string | null = null;

	try {
		const text = await request.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				body = text.substring(0, 1000);
			}
		}
	} catch (e) {
		bodyError = e instanceof Error ? e.message : 'Unknown error reading body';
	}

	const fullDebugInfo = {
		...debugInfo,
		body: {
			content: body,
			error: bodyError,
			hasBody: body !== null
		}
	};

	console.log('=== PUT BODY ===');
	console.log(JSON.stringify(fullDebugInfo.body, null, 2));
	console.log('=== END PUT BODY ===');

	return new Response(JSON.stringify(fullDebugInfo, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
