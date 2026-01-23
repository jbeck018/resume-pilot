/**
 * Subscription Types
 *
 * Type definitions for the subscription system
 */

import type { Database, TierFeatures, SubscriptionStatus, BillingInterval } from '../database/types';

// Table row types from database
export type SubscriptionTier = Database['public']['Tables']['subscription_tiers']['Row'];
export type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];
export type UsageTracking = Database['public']['Tables']['usage_tracking']['Row'];
export type SubscriptionEvent = Database['public']['Tables']['subscription_events']['Row'];

// Re-export for convenience
export type { TierFeatures, SubscriptionStatus, BillingInterval };

// Subscription with tier details
export interface SubscriptionWithTier extends UserSubscription {
	tier: SubscriptionTier;
}

// Usage limit check result
export interface UsageLimitResult {
	canGenerate: boolean;
	generationsUsed: number;
	generationLimit: number;
	remaining: number;
	tierName: string;
	resetsAt: Date;
	isUnlimited: boolean;
}

// Usage increment result
export interface UsageIncrementResult {
	success: boolean;
	newCount: number;
	limitReached: boolean;
}

// Checkout session creation params
export interface CreateCheckoutParams {
	userId: string;
	userEmail: string;
	tierId: string;
	billingInterval: BillingInterval;
	successUrl: string;
	cancelUrl: string;
}

// Customer portal params
export interface CreatePortalParams {
	userId: string;
	returnUrl: string;
}

// Stripe webhook event types we handle
export type StripeWebhookEvent =
	| 'checkout.session.completed'
	| 'customer.subscription.created'
	| 'customer.subscription.updated'
	| 'customer.subscription.deleted'
	| 'invoice.paid'
	| 'invoice.payment_failed'
	| 'customer.subscription.trial_will_end';

// Subscription event data for logging
export interface SubscriptionEventData {
	eventType: string;
	tierId?: string;
	tierName?: string;
	previousTierId?: string;
	previousTierName?: string;
	stripeEventId?: string;
	amount?: number;
	currency?: string;
	reason?: string;
	[key: string]: unknown;
}

// Tier comparison for upgrade/downgrade detection
export interface TierChange {
	previousTier: SubscriptionTier | null;
	newTier: SubscriptionTier;
	isUpgrade: boolean;
	isDowngrade: boolean;
	priceDifference: number;
}

// Usage summary for dashboard
export interface UsageSummary {
	currentPeriod: {
		start: Date;
		end: Date;
		generationsUsed: number;
		generationLimit: number;
		remaining: number;
		percentUsed: number;
	};
	subscription: {
		tierName: string;
		tierDisplayName: string;
		status: SubscriptionStatus;
		billingInterval: BillingInterval;
		renewsAt: Date | null;
		cancelAtPeriodEnd: boolean;
	};
	features: TierFeatures;
}

// Pricing display for frontend
export interface PricingTier {
	id: string;
	name: string;
	displayName: string;
	description: string | null;
	priceMonthly: number; // in cents
	priceYearly: number; // in cents
	priceMonthlyFormatted: string;
	priceYearlyFormatted: string;
	monthlyEquivalentYearly: string; // e.g., "$7.49/mo" for yearly plan
	generationLimitWeekly: number;
	generationLimitDisplay: string; // e.g., "5/week" or "Unlimited"
	features: TierFeatures;
	featuresList: string[]; // Flat list for display
	badgeText: string | null;
	isPopular: boolean;
	isCurrent: boolean;
	stripePriceMonthlyId: string | null;
	stripePriceYearlyId: string | null;
}
