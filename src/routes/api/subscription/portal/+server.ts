/**
 * Stripe Customer Portal API
 *
 * POST /api/subscription/portal - Create a Stripe customer portal session
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { stripeService } from '$lib/server/subscription';
import { PUBLIC_APP_URL } from '$env/static/public';

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if Stripe is configured
	if (!stripeService.isConfigured()) {
		return json({ error: 'Payment processing is not configured' }, { status: 503 });
	}

	try {
		const portalUrl = await stripeService.createPortalSession({
			userId: user.id,
			returnUrl: `${PUBLIC_APP_URL}/dashboard/subscription`
		});

		return json({ url: portalUrl });
	} catch (error) {
		console.error('Error creating portal session:', error);

		if (error instanceof Error) {
			// Check for specific error types
			if (error.message.includes('No Stripe customer')) {
				return json(
					{
						error: 'No billing information found. Please subscribe to a plan first.'
					},
					{ status: 400 }
				);
			}

			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: 'Failed to create portal session' }, { status: 500 });
	}
};
