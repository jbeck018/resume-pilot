// =============================================================================
// Health Check Endpoint
// =============================================================================
// Used by Docker HEALTHCHECK and load balancers to verify the app is running
//
// Returns:
//   200 OK - Application is healthy
//   503 Service Unavailable - Application is unhealthy
//
// Response includes:
//   - status: 'healthy' | 'unhealthy'
//   - timestamp: ISO 8601 timestamp
//   - uptime: Process uptime in seconds
//   - version: Application version from package.json
// =============================================================================

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Track when the server started
const startTime = Date.now();

export const GET: RequestHandler = async () => {
	try {
		// Basic health check - just verify the server can respond
		// Add additional checks here as needed (database, cache, etc.)

		const healthData = {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			uptime: Math.floor((Date.now() - startTime) / 1000),
			version: process.env.npm_package_version || '0.1.0',
			environment: process.env.NODE_ENV || 'development'
		};

		return json(healthData, {
			status: 200,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		});
	} catch (error) {
		// If anything fails, return unhealthy status
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{
				status: 503,
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		);
	}
};

// Also support HEAD requests for simple health probes
export const HEAD: RequestHandler = async () => {
	return new Response(null, { status: 200 });
};
