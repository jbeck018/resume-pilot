/**
 * Stripe Service
 *
 * Handles Stripe integration for subscription billing
 */

import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { subscriptionService } from './subscription-service';
import type { CreateCheckoutParams, CreatePortalParams, BillingInterval } from './types';
import {
	StripeCustomerNotFoundError,
	StripeWebhookError,
	TierNotFoundError,
	InvalidBillingIntervalError
} from './errors';

class StripeServiceImpl {
	private stripe: Stripe | null = null;

	private getStripe(): Stripe {
		if (!this.stripe) {
			if (!env.STRIPE_SECRET_KEY) {
				throw new Error('STRIPE_SECRET_KEY is not configured');
			}
			this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
				apiVersion: '2025-02-24.acacia'
			});
		}
		return this.stripe;
	}

	/**
	 * Check if Stripe is configured
	 */
	isConfigured(): boolean {
		return !!env.STRIPE_SECRET_KEY;
	}

	// =========================================================================
	// Customer Management
	// =========================================================================

	/**
	 * Get or create a Stripe customer for a user
	 */
	async getOrCreateCustomer(userId: string, email: string): Promise<string> {
		const stripe = this.getStripe();

		// Check if user already has a Stripe customer
		const subscription = await subscriptionService.getUserSubscription(userId);
		if (subscription?.stripe_customer_id) {
			return subscription.stripe_customer_id;
		}

		// Search for existing customer by email
		const existingCustomers = await stripe.customers.list({
			email,
			limit: 1
		});

		if (existingCustomers.data.length > 0) {
			const customerId = existingCustomers.data[0].id;

			// Update subscription with customer ID
			if (subscription) {
				await subscriptionService.updateSubscription(userId, {
					stripeCustomerId: customerId
				});
			}

			return customerId;
		}

		// Create new customer
		const customer = await stripe.customers.create({
			email,
			metadata: {
				userId
			}
		});

		// Update subscription with customer ID
		if (subscription) {
			await subscriptionService.updateSubscription(userId, {
				stripeCustomerId: customer.id
			});
		}

		return customer.id;
	}

	// =========================================================================
	// Checkout Sessions
	// =========================================================================

	/**
	 * Create a checkout session for subscription
	 */
	async createCheckoutSession(params: CreateCheckoutParams): Promise<string> {
		const stripe = this.getStripe();

		// Get the tier
		const tier = await subscriptionService.getTierById(params.tierId);
		if (!tier) {
			throw new TierNotFoundError(params.tierId);
		}

		// Get the appropriate price ID
		const priceId =
			params.billingInterval === 'yearly'
				? tier.stripe_price_yearly_id
				: tier.stripe_price_monthly_id;

		if (!priceId) {
			throw new InvalidBillingIntervalError(
				`No Stripe price configured for ${tier.name} ${params.billingInterval}`
			);
		}

		// Get or create customer
		const customerId = await this.getOrCreateCustomer(params.userId, params.userEmail);

		// Create checkout session
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			mode: 'subscription',
			line_items: [
				{
					price: priceId,
					quantity: 1
				}
			],
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			subscription_data: {
				metadata: {
					userId: params.userId,
					tierId: params.tierId
				}
			},
			metadata: {
				userId: params.userId,
				tierId: params.tierId,
				billingInterval: params.billingInterval
			}
		});

		return session.url || '';
	}

	// =========================================================================
	// Customer Portal
	// =========================================================================

	/**
	 * Create a customer portal session
	 */
	async createPortalSession(params: CreatePortalParams): Promise<string> {
		const stripe = this.getStripe();

		// Get user's subscription
		const subscription = await subscriptionService.getUserSubscription(params.userId);
		if (!subscription?.stripe_customer_id) {
			throw new StripeCustomerNotFoundError(params.userId);
		}

		const session = await stripe.billingPortal.sessions.create({
			customer: subscription.stripe_customer_id,
			return_url: params.returnUrl
		});

		return session.url;
	}

	// =========================================================================
	// Webhook Handling
	// =========================================================================

	/**
	 * Verify and construct webhook event
	 */
	constructEvent(payload: string, signature: string): Stripe.Event {
		const stripe = this.getStripe();

		if (!env.STRIPE_WEBHOOK_SECRET) {
			throw new StripeWebhookError('STRIPE_WEBHOOK_SECRET is not configured');
		}

		try {
			return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
		} catch (err) {
			throw new StripeWebhookError(
				`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Handle Stripe webhook event
	 */
	async handleWebhookEvent(event: Stripe.Event): Promise<void> {
		switch (event.type) {
			case 'checkout.session.completed':
				await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
				break;

			case 'customer.subscription.created':
			case 'customer.subscription.updated':
				await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
				break;

			case 'customer.subscription.deleted':
				await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
				break;

			case 'invoice.paid':
				await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
				break;

			case 'invoice.payment_failed':
				await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
				break;

			default:
				// Unhandled event type - handled as expected
		}
	}

	/**
	 * Handle successful checkout
	 */
	private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
		const userId = session.metadata?.userId;
		const tierId = session.metadata?.tierId;
		const billingInterval = session.metadata?.billingInterval as BillingInterval;

		if (!userId || !tierId) {
			console.error('Missing metadata in checkout session:', session.id);
			return;
		}

		// Update subscription
		await subscriptionService.updateSubscription(userId, {
			tierId,
			stripeCustomerId: session.customer as string,
			stripeSubscriptionId: session.subscription as string,
			billingInterval,
			status: 'active'
		});

		// Log event
		const subscription = await subscriptionService.getUserSubscription(userId);
		if (subscription) {
			await subscriptionService.logEvent(userId, subscription.id, 'subscription_created', {
				eventType: 'checkout_completed',
				tierId,
				tierName: subscription.tier.name,
				stripeEventId: session.id
			});
		}
	}

	/**
	 * Handle subscription update from Stripe
	 */
	private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
		const userId = stripeSubscription.metadata?.userId;
		if (!userId) {
			console.error('Missing userId in subscription metadata:', stripeSubscription.id);
			return;
		}

		// Map Stripe status to our status
		const statusMap: Record<string, string> = {
			active: 'active',
			past_due: 'past_due',
			canceled: 'canceled',
			incomplete: 'incomplete',
			incomplete_expired: 'canceled',
			trialing: 'trialing',
			unpaid: 'past_due',
			paused: 'paused'
		};

		const status = statusMap[stripeSubscription.status] || 'active';

		await subscriptionService.updateSubscription(userId, {
			stripeSubscriptionId: stripeSubscription.id,
			stripePriceId: stripeSubscription.items.data[0]?.price.id,
			status: status as any,
			currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
			currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
			cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
		});
	}

	/**
	 * Handle subscription cancellation
	 */
	private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
		const userId = stripeSubscription.metadata?.userId;
		if (!userId) {
			console.error('Missing userId in subscription metadata:', stripeSubscription.id);
			return;
		}

		// Downgrade to free tier
		const freeTier = await subscriptionService.getTierByName('free');

		await subscriptionService.updateSubscription(userId, {
			tierId: freeTier.id,
			status: 'active',
			stripeSubscriptionId: undefined as any, // Clear Stripe subscription
			stripePriceId: undefined as any,
			currentPeriodStart: undefined as any,
			currentPeriodEnd: undefined as any,
			cancelAtPeriodEnd: false
		});

		// Log event
		const subscription = await subscriptionService.getUserSubscription(userId);
		if (subscription) {
			await subscriptionService.logEvent(userId, subscription.id, 'subscription_canceled', {
				eventType: 'subscription_deleted',
				stripeEventId: stripeSubscription.id
			});
		}
	}

	/**
	 * Handle successful payment
	 */
	private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
		const customerId = invoice.customer as string;

		// Find user by Stripe customer ID
		const subscription = await this.findSubscriptionByCustomerId(customerId);
		if (!subscription) {
			console.error('No subscription found for customer:', customerId);
			return;
		}

		// Log payment event
		await subscriptionService.logEvent(subscription.user_id, subscription.id, 'payment_succeeded', {
			eventType: 'invoice_paid',
			amount: invoice.amount_paid,
			currency: invoice.currency,
			stripeEventId: invoice.id
		});
	}

	/**
	 * Handle failed payment
	 */
	private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
		const customerId = invoice.customer as string;

		// Find user by Stripe customer ID
		const subscription = await this.findSubscriptionByCustomerId(customerId);
		if (!subscription) {
			console.error('No subscription found for customer:', customerId);
			return;
		}

		// Update status to past_due
		await subscriptionService.updateSubscription(subscription.user_id, {
			status: 'past_due'
		});

		// Log payment failure
		await subscriptionService.logEvent(subscription.user_id, subscription.id, 'payment_failed', {
			eventType: 'invoice_payment_failed',
			amount: invoice.amount_due,
			currency: invoice.currency,
			stripeEventId: invoice.id
		});
	}

	/**
	 * Find subscription by Stripe customer ID
	 */
	private async findSubscriptionByCustomerId(customerId: string) {
		const { createServerClient } = await import('@supabase/ssr');
		const { env: publicEnvDynamic } = await import('$env/dynamic/public');
		const { env: envDynamic } = await import('$env/dynamic/private');

		const supabase = createServerClient(publicEnvDynamic.PUBLIC_SUPABASE_URL!, envDynamic.SUPABASE_SERVICE_ROLE_KEY!, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});

		const { data } = await supabase
			.from('user_subscriptions')
			.select('*')
			.eq('stripe_customer_id', customerId)
			.single();

		return data;
	}

	// =========================================================================
	// Subscription Management via Stripe API
	// =========================================================================

	/**
	 * Cancel a Stripe subscription
	 */
	async cancelStripeSubscription(subscriptionId: string, immediately = false): Promise<void> {
		const stripe = this.getStripe();

		if (immediately) {
			await stripe.subscriptions.cancel(subscriptionId);
		} else {
			await stripe.subscriptions.update(subscriptionId, {
				cancel_at_period_end: true
			});
		}
	}

	/**
	 * Reactivate a canceled Stripe subscription
	 */
	async reactivateStripeSubscription(subscriptionId: string): Promise<void> {
		const stripe = this.getStripe();

		await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: false
		});
	}

	/**
	 * Change subscription plan
	 */
	async changeSubscriptionPlan(
		subscriptionId: string,
		newPriceId: string,
		prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'
	): Promise<void> {
		const stripe = this.getStripe();

		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		const itemId = subscription.items.data[0]?.id;

		if (!itemId) {
			throw new Error('No subscription item found');
		}

		await stripe.subscriptions.update(subscriptionId, {
			items: [
				{
					id: itemId,
					price: newPriceId
				}
			],
			proration_behavior: prorationBehavior
		});
	}
}

// Export singleton instance
export const StripeService = StripeServiceImpl;
export const stripeService = new StripeServiceImpl();
