/**
 * Stripe Webhook Handler
 *
 * Handles incoming Stripe webhook events for subscription management
 *
 * POST /api/stripe/webhook
 */

import { json, text, type RequestHandler } from '@sveltejs/kit';
import { stripeService } from '$lib/server/subscription';

export const POST: RequestHandler = async ({ request }) => {
	// Get the raw body for signature verification
	const payload = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return json({ error: 'Missing signature' }, { status: 400 });
	}

	try {
		// Verify webhook signature and construct event
		const event = stripeService.constructEvent(payload, signature);

		// Handle the event
		await stripeService.handleWebhookEvent(event);

		return json({ received: true });
	} catch (error) {
		console.error('Stripe webhook error:', error);

		if (error instanceof Error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};

// Stripe requires raw body, so we need to disable body parsing
export const prerender = false;
