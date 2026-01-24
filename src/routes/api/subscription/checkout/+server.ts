/**
 * Stripe Checkout API
 *
 * POST /api/subscription/checkout - Create a Stripe checkout session
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { stripeService, subscriptionService } from '$lib/server/subscription';
import { env } from '$env/dynamic/public';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if Stripe is configured
	if (!stripeService.isConfigured()) {
		return json({ error: 'Payment processing is not configured' }, { status: 503 });
	}

	try {
		const body = await request.json();
		const { tierId, billingInterval = 'monthly' } = body;

		if (!tierId) {
			return json({ error: 'Tier ID is required' }, { status: 400 });
		}

		if (!['monthly', 'yearly'].includes(billingInterval)) {
			return json({ error: 'Invalid billing interval' }, { status: 400 });
		}

		// Verify the tier exists and is purchasable
		const tier = await subscriptionService.getTierById(tierId);
		if (tier.name === 'free') {
			return json({ error: 'Cannot checkout for free tier' }, { status: 400 });
		}

		// Check if user is already on this tier
		const currentSubscription = await subscriptionService.getUserSubscription(user.id);
		if (currentSubscription?.tier_id === tierId && currentSubscription?.status === 'active') {
			return json({ error: 'Already subscribed to this tier' }, { status: 400 });
		}

		// Create checkout session
		const checkoutUrl = await stripeService.createCheckoutSession({
			userId: user.id,
			userEmail: user.email!,
			tierId,
			billingInterval,
			successUrl: `${env.PUBLIC_APP_URL}/dashboard/subscription?success=true`,
			cancelUrl: `${env.PUBLIC_APP_URL}/pricing?canceled=true`
		});

		return json({ url: checkoutUrl });
	} catch (error) {
		console.error('Error creating checkout session:', error);

		if (error instanceof Error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: 'Failed to create checkout session' }, { status: 500 });
	}
};
