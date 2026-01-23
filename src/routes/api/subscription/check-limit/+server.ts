/**
 * Check Usage Limit API
 *
 * GET /api/subscription/check-limit - Quick check if user can generate
 *
 * This is a lightweight endpoint for pre-generation checks
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { usageService } from '$lib/server/subscription';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const usageLimit = await usageService.checkUsageLimit(user.id);

		return json({
			canGenerate: usageLimit.canGenerate,
			remaining: usageLimit.remaining,
			limit: usageLimit.generationLimit,
			isUnlimited: usageLimit.isUnlimited,
			resetsAt: usageLimit.resetsAt.toISOString(),
			tier: usageLimit.tierName
		});
	} catch (error) {
		console.error('Error checking limit:', error);
		return json({ error: 'Failed to check limit' }, { status: 500 });
	}
};
