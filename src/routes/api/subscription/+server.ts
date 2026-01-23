/**
 * Subscription API
 *
 * GET /api/subscription - Get current user's subscription status
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { subscriptionService, usageService } from '$lib/server/subscription';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const [subscription, usageLimit] = await Promise.all([
			subscriptionService.getOrCreateSubscription(user.id),
			usageService.checkUsageLimit(user.id)
		]);

		return json({
			subscription: {
				id: subscription.id,
				status: subscription.status,
				tier: {
					id: subscription.tier.id,
					name: subscription.tier.name,
					displayName: subscription.tier.display_name,
					generationLimitWeekly: subscription.tier.generation_limit_weekly,
					features: subscription.tier.features
				},
				billingInterval: subscription.billing_interval,
				currentPeriodEnd: subscription.current_period_end,
				cancelAtPeriodEnd: subscription.cancel_at_period_end
			},
			usage: {
				generationsUsed: usageLimit.generationsUsed,
				generationLimit: usageLimit.generationLimit,
				remaining: usageLimit.remaining,
				isUnlimited: usageLimit.isUnlimited,
				resetsAt: usageLimit.resetsAt.toISOString()
			}
		});
	} catch (error) {
		console.error('Error fetching subscription:', error);
		return json({ error: 'Failed to fetch subscription' }, { status: 500 });
	}
};
