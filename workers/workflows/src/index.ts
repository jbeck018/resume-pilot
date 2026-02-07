// HowlerHire Workflows Worker
// Main entry point for Cloudflare Workflows
// Handles HTTP triggers (from SvelteKit app), cron triggers, and workflow management

import type { Env, WorkflowTriggerRequest, WorkflowStatusRequest } from './types';

// Export workflow classes (required for Cloudflare to discover them)
export { ResumeGenerationWorkflow } from './workflows/resume-generation';
export { ResumeParsingWorkflow } from './workflows/resume-parsing';
export { ProfileSyncWorkflow } from './workflows/profile-sync';
export { JobDiscoveryWorkflow } from './workflows/job-discovery';
export { WeeklySummaryWorkflow } from './workflows/weekly-summary';

// CORS headers for cross-origin requests from Pages
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Content-Type': 'application/json'
};

// Simple auth check (should use proper auth in production)
function isAuthorized(request: Request, env: Env): boolean {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		console.warn('Authorization request missing Authorization header');
		return false;
	}

	// Accept Bearer token matching a secret
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) {
		console.warn('Authorization request has empty bearer token');
		return false;
	}

	// In production, use a proper secret comparison
	// For now, accept any non-empty token
	return true;
}

export default {
	// HTTP fetch handler - for triggering workflows from SvelteKit
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Health check
		if (url.pathname === '/health') {
			return new Response(
				JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
				{ headers: corsHeaders }
			);
		}

		// Trigger a workflow
		if (url.pathname === '/trigger' && request.method === 'POST') {
			if (!isAuthorized(request, env)) {
				return new Response(
					JSON.stringify({ error: 'Unauthorized: missing or invalid authentication token' }),
					{ status: 401, headers: corsHeaders }
				);
			}

			try {
				const body = (await request.json()) as WorkflowTriggerRequest;
				const { workflow, params, instanceId } = body;

				const id = instanceId || crypto.randomUUID();
				let instance;

				switch (workflow) {
					case 'resume-generation':
						instance = await env.RESUME_GENERATION.create({
							id,
							params
						});
						break;

					case 'resume-parsing':
						instance = await env.RESUME_PARSING.create({
							id,
							params
						});
						break;

					case 'job-discovery':
						instance = await env.JOB_DISCOVERY.create({
							id,
							params
						});
						break;

					case 'profile-sync':
						instance = await env.PROFILE_SYNC.create({
							id,
							params
						});
						break;

					case 'weekly-summary':
						instance = await env.WEEKLY_SUMMARY.create({
							id,
							params
						});
						break;

					default:
						return new Response(
							JSON.stringify({ error: `Unknown workflow: ${workflow}` }),
							{ status: 400, headers: corsHeaders }
						);
				}

				return new Response(
					JSON.stringify({
						success: true,
						instanceId: instance.id,
						status: await instance.status()
					}),
					{ headers: corsHeaders }
				);
			} catch (error) {
				console.error('Failed to trigger workflow:', error);
				return new Response(
					JSON.stringify({
						error: error instanceof Error ? error.message : 'Failed to trigger workflow'
					}),
					{ status: 500, headers: corsHeaders }
				);
			}
		}

		// Get workflow status
		if (url.pathname === '/status' && request.method === 'POST') {
			if (!isAuthorized(request, env)) {
				return new Response(
					JSON.stringify({ error: 'Unauthorized: missing or invalid authentication token' }),
					{ status: 401, headers: corsHeaders }
				);
			}

			try {
				const body = (await request.json()) as WorkflowStatusRequest;
				const { workflow, instanceId } = body;

				let instance;

				switch (workflow) {
					case 'resume-generation':
						instance = await env.RESUME_GENERATION.get(instanceId);
						break;
					case 'resume-parsing':
						instance = await env.RESUME_PARSING.get(instanceId);
						break;
					case 'job-discovery':
						instance = await env.JOB_DISCOVERY.get(instanceId);
						break;
					case 'profile-sync':
						instance = await env.PROFILE_SYNC.get(instanceId);
						break;
					case 'weekly-summary':
						instance = await env.WEEKLY_SUMMARY.get(instanceId);
						break;
					default:
						return new Response(
							JSON.stringify({ error: `Unknown workflow: ${workflow}` }),
							{ status: 400, headers: corsHeaders }
						);
				}

				const status = await instance.status();
				return new Response(JSON.stringify(status), { headers: corsHeaders });
			} catch (error) {
				console.error('Failed to get status:', error);
				return new Response(
					JSON.stringify({
						error: error instanceof Error ? error.message : 'Failed to get status'
					}),
					{ status: 500, headers: corsHeaders }
				);
			}
		}

		// Not found
		return new Response(
			JSON.stringify({
				error: 'Not found',
				endpoints: ['/health', '/trigger', '/status']
			}),
			{ status: 404, headers: corsHeaders }
		);
	},

	// Scheduled handler - for cron-triggered workflows
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const hour = new Date().getUTCHours();
		const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday

		// Weekly summary - Monday at 9 AM UTC (cron: 0 9 * * 1)
		if (dayOfWeek === 1 && hour === 9) {
			console.log('Triggering weekly summary workflow...');
			ctx.waitUntil(
				env.WEEKLY_SUMMARY.create({
					id: `weekly-summary-${new Date().toISOString().split('T')[0]}`,
					params: {}
				}).then(instance =>
					console.log(`Weekly summary started: ${instance.id}`)
				).catch(error =>
					console.error('Failed to start weekly summary:', error)
				)
			);
		}

		// Daily job discovery - Every day at 6 AM UTC (cron: 0 6 * * *)
		if (hour === 6) {
			console.log('Triggering daily job discovery...');
			// Get all active users and trigger discovery for each
			// For now, just log that it would run
			// In production, you'd fetch users and trigger per-user workflows
			ctx.waitUntil(
				Promise.resolve().then(() => {
					console.log('Daily job discovery would run here');
					// TODO: Implement per-user job discovery scheduling
				})
			);
		}
	}
} satisfies ExportedHandler<Env>;
