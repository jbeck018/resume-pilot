/**
 * Subscription Tiers API
 *
 * GET /api/subscription/tiers - Get all available subscription tiers
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { subscriptionService } from '$lib/server/subscription';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	try {
		// Get current user's tier ID if logged in
		let currentTierId: string | undefined;
		if (user) {
			const subscription = await subscriptionService.getUserSubscription(user.id);
			currentTierId = subscription?.tier_id;
		}

		// Get pricing tiers with current tier marked
		const tiers = await subscriptionService.getPricingTiers(currentTierId);

		return json({ tiers });
	} catch (error) {
		console.error('Error fetching tiers:', error);
		return json({ error: 'Failed to fetch subscription tiers' }, { status: 500 });
	}
};
