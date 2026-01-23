/**
 * Usage API
 *
 * GET /api/subscription/usage - Get current user's usage statistics
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { usageService, subscriptionService } from '$lib/server/subscription';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const [usageLimit, currentPeriodUsage, subscription] = await Promise.all([
			usageService.checkUsageLimit(user.id),
			usageService.getCurrentPeriodUsage(user.id),
			subscriptionService.getUserSubscription(user.id)
		]);

		const percentUsed = usageLimit.isUnlimited
			? 0
			: Math.round((usageLimit.generationsUsed / usageLimit.generationLimit) * 100);

		return json({
			tier: usageLimit.tierName,
			period: {
				start: usageService.getWeekStart().toISOString(),
				end: usageLimit.resetsAt.toISOString()
			},
			generations: {
				used: usageLimit.generationsUsed,
				limit: usageLimit.generationLimit,
				remaining: usageLimit.remaining,
				isUnlimited: usageLimit.isUnlimited,
				percentUsed
			},
			canGenerate: usageLimit.canGenerate,
			details: currentPeriodUsage?.usage_details || {},
			subscription: subscription
				? {
						status: subscription.status,
						renewsAt: subscription.current_period_end,
						cancelAtPeriodEnd: subscription.cancel_at_period_end
					}
				: null
		});
	} catch (error) {
		console.error('Error fetching usage:', error);
		return json({ error: 'Failed to fetch usage' }, { status: 500 });
	}
};
