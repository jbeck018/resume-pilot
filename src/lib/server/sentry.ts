/**
 * Sentry configuration for Cloudflare Workers/Pages
 * Uses @sentry/sveltekit with Cloudflare-specific initialization
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/sveltekit/
 */

import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

// Re-export Sentry for use elsewhere
export { Sentry };

// Re-export Cloudflare-specific handlers
export {
	initCloudflareSentryHandle,
	sentryHandle,
	handleErrorWithSentry
} from '@sentry/sveltekit';

/**
 * Get the Sentry DSN from environment
 * Returns undefined if not configured (Sentry will be disabled)
 */
export function getSentryDsn(): string | undefined {
	return env.PUBLIC_SENTRY_DSN;
}

/**
 * Helper to manually capture exceptions with context
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
	// Log to console for debugging in Cloudflare
	console.error('=== SERVER ERROR ===');
	console.error('Error:', error);
	if (context) {
		console.error('Context:', JSON.stringify(context, null, 2));
	}
	if (error instanceof Error) {
		console.error('Stack:', error.stack);
	}
	console.error('====================');

	// Send to Sentry if DSN is configured
	if (getSentryDsn()) {
		Sentry.captureException(error, {
			extra: context
		});
	}
}

/**
 * Sentry configuration options for Cloudflare
 */
export function getSentryConfig() {
	const dsn = getSentryDsn();

	if (!dsn) {
		console.warn('Sentry DSN not configured - error tracking disabled');
		return null;
	}

	return {
		dsn,
		// Enable sending PII (user IP, request headers) - review for privacy compliance
		sendDefaultPii: true,
		// Sample rate for performance tracing (1.0 = 100% of requests)
		// Reduce in production if needed for cost/performance
		tracesSampleRate: 1.0,
		// Enable Sentry logs
		enableLogs: true,
		// Environment from public env or default to 'development'
		environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'development'
	};
}
