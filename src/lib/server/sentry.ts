import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';

let initialized = false;

export function initSentry() {
	if (initialized) return;

	const dsn = env.SENTRY_DSN;
	if (!dsn) {
		console.warn('SENTRY_DSN not set, error tracking disabled');
		return;
	}

	Sentry.init({
		dsn,
		environment: env.PUBLIC_APP_URL?.includes('localhost') ? 'development' : 'production',
		tracesSampleRate: 0.1,
		integrations: []
	});

	initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
	console.error('Server error:', error);

	if (context) {
		Sentry.setContext('additional', context);
	}

	Sentry.captureException(error);
}

export { Sentry };
