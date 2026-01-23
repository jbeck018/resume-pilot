/**
 * Subscription Service
 *
 * Handles subscription CRUD operations and tier management
 */

import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type {
	SubscriptionTier,
	UserSubscription,
	SubscriptionWithTier,
	PricingTier,
	UsageSummary,
	TierChange,
	SubscriptionEventData,
	BillingInterval,
	SubscriptionStatus
} from './types';
import { SubscriptionNotFoundError, TierNotFoundError } from './errors';
import { usageService } from './usage-service';

class SubscriptionServiceImpl {
	private getSupabase() {
		return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});
	}

	// =========================================================================
	// Tier Operations
	// =========================================================================

	/**
	 * Get all active subscription tiers
	 */
	async getTiers(): Promise<SubscriptionTier[]> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('subscription_tiers')
			.select('*')
			.eq('is_active', true)
			.order('sort_order', { ascending: true });

		if (error) throw error;
		return data || [];
	}

	/**
	 * Get a specific tier by ID
	 */
	async getTierById(tierId: string): Promise<SubscriptionTier> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('subscription_tiers')
			.select('*')
			.eq('id', tierId)
			.single();

		if (error || !data) throw new TierNotFoundError(tierId);
		return data;
	}

	/**
	 * Get a tier by name (free, pro, premium)
	 */
	async getTierByName(name: string): Promise<SubscriptionTier> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('subscription_tiers')
			.select('*')
			.eq('name', name)
			.eq('is_active', true)
			.single();

		if (error || !data) throw new TierNotFoundError(name);
		return data;
	}

	/**
	 * Get pricing tiers formatted for frontend display
	 */
	async getPricingTiers(currentTierId?: string): Promise<PricingTier[]> {
		const tiers = await this.getTiers();

		return tiers.map((tier) => ({
			id: tier.id,
			name: tier.name,
			displayName: tier.display_name,
			description: tier.description,
			priceMonthly: tier.price_monthly,
			priceYearly: tier.price_yearly,
			priceMonthlyFormatted: this.formatPrice(tier.price_monthly),
			priceYearlyFormatted: this.formatPrice(tier.price_yearly),
			monthlyEquivalentYearly: this.formatPrice(Math.round(tier.price_yearly / 12)),
			generationLimitWeekly: tier.generation_limit_weekly,
			generationLimitDisplay:
				tier.generation_limit_weekly === -1
					? 'Unlimited'
					: `${tier.generation_limit_weekly}/week`,
			features: tier.features,
			featuresList: this.flattenFeatures(tier.features),
			badgeText: tier.badge_text,
			isPopular: tier.badge_text === 'Most Popular',
			isCurrent: tier.id === currentTierId,
			stripePriceMonthlyId: tier.stripe_price_monthly_id,
			stripePriceYearlyId: tier.stripe_price_yearly_id
		}));
	}

	// =========================================================================
	// User Subscription Operations
	// =========================================================================

	/**
	 * Get a user's subscription with tier details
	 */
	async getUserSubscription(userId: string): Promise<SubscriptionWithTier | null> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('user_subscriptions')
			.select(
				`
				*,
				tier:subscription_tiers(*)
			`
			)
			.eq('user_id', userId)
			.single();

		if (error) {
			if (error.code === 'PGRST116') return null; // Not found
			throw error;
		}

		return data as SubscriptionWithTier;
	}

	/**
	 * Get or create user subscription (ensures user has at least free tier)
	 */
	async getOrCreateSubscription(userId: string): Promise<SubscriptionWithTier> {
		let subscription = await this.getUserSubscription(userId);

		if (!subscription) {
			// Create free tier subscription
			const freeTier = await this.getTierByName('free');
			subscription = await this.createSubscription(userId, freeTier.id);
		}

		return subscription;
	}

	/**
	 * Create a new subscription for a user
	 */
	async createSubscription(
		userId: string,
		tierId: string,
		options: {
			stripeCustomerId?: string;
			stripeSubscriptionId?: string;
			stripePriceId?: string;
			billingInterval?: BillingInterval;
			status?: SubscriptionStatus;
			currentPeriodStart?: Date;
			currentPeriodEnd?: Date;
		} = {}
	): Promise<SubscriptionWithTier> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('user_subscriptions')
			.insert({
				user_id: userId,
				tier_id: tierId,
				status: options.status || 'active',
				stripe_customer_id: options.stripeCustomerId || null,
				stripe_subscription_id: options.stripeSubscriptionId || null,
				stripe_price_id: options.stripePriceId || null,
				billing_interval: options.billingInterval || 'monthly',
				current_period_start: options.currentPeriodStart?.toISOString() || null,
				current_period_end: options.currentPeriodEnd?.toISOString() || null
			})
			.select(
				`
				*,
				tier:subscription_tiers(*)
			`
			)
			.single();

		if (error) throw error;

		// Log event
		await this.logEvent(userId, data.id, 'subscription_created', {
			eventType: 'subscription_created',
			tierId,
			tierName: (data as SubscriptionWithTier).tier.name
		});

		return data as SubscriptionWithTier;
	}

	/**
	 * Update a user's subscription
	 */
	async updateSubscription(
		userId: string,
		updates: Partial<{
			tierId: string;
			status: SubscriptionStatus;
			stripeCustomerId: string;
			stripeSubscriptionId: string;
			stripePriceId: string;
			billingInterval: BillingInterval;
			currentPeriodStart: Date;
			currentPeriodEnd: Date;
			cancelAtPeriodEnd: boolean;
			canceledAt: Date;
			cancellationReason: string;
			trialStart: Date;
			trialEnd: Date;
		}>
	): Promise<SubscriptionWithTier> {
		const supabase = this.getSupabase();

		// Get current subscription for comparison
		const currentSub = await this.getUserSubscription(userId);
		if (!currentSub) throw new SubscriptionNotFoundError(userId);

		const dbUpdates: Record<string, unknown> = {};
		if (updates.tierId !== undefined) dbUpdates.tier_id = updates.tierId;
		if (updates.status !== undefined) dbUpdates.status = updates.status;
		if (updates.stripeCustomerId !== undefined)
			dbUpdates.stripe_customer_id = updates.stripeCustomerId;
		if (updates.stripeSubscriptionId !== undefined)
			dbUpdates.stripe_subscription_id = updates.stripeSubscriptionId;
		if (updates.stripePriceId !== undefined) dbUpdates.stripe_price_id = updates.stripePriceId;
		if (updates.billingInterval !== undefined)
			dbUpdates.billing_interval = updates.billingInterval;
		if (updates.currentPeriodStart !== undefined)
			dbUpdates.current_period_start = updates.currentPeriodStart.toISOString();
		if (updates.currentPeriodEnd !== undefined)
			dbUpdates.current_period_end = updates.currentPeriodEnd.toISOString();
		if (updates.cancelAtPeriodEnd !== undefined)
			dbUpdates.cancel_at_period_end = updates.cancelAtPeriodEnd;
		if (updates.canceledAt !== undefined) dbUpdates.canceled_at = updates.canceledAt.toISOString();
		if (updates.cancellationReason !== undefined)
			dbUpdates.cancellation_reason = updates.cancellationReason;
		if (updates.trialStart !== undefined)
			dbUpdates.trial_start = updates.trialStart.toISOString();
		if (updates.trialEnd !== undefined) dbUpdates.trial_end = updates.trialEnd.toISOString();

		const { data, error } = await supabase
			.from('user_subscriptions')
			.update(dbUpdates)
			.eq('user_id', userId)
			.select(
				`
				*,
				tier:subscription_tiers(*)
			`
			)
			.single();

		if (error) throw error;

		// Log tier change if applicable
		if (updates.tierId && updates.tierId !== currentSub.tier_id) {
			const tierChange = await this.detectTierChange(currentSub.tier_id, updates.tierId);
			const eventType = tierChange.isUpgrade ? 'tier_upgraded' : 'tier_downgraded';
			await this.logEvent(userId, data.id, eventType, {
				eventType,
				previousTierId: currentSub.tier_id,
				previousTierName: currentSub.tier.name,
				tierId: updates.tierId,
				tierName: tierChange.newTier.name,
				priceDifference: tierChange.priceDifference
			});
		}

		return data as SubscriptionWithTier;
	}

	/**
	 * Cancel a subscription (at period end)
	 */
	async cancelSubscription(
		userId: string,
		reason?: string
	): Promise<SubscriptionWithTier> {
		return this.updateSubscription(userId, {
			cancelAtPeriodEnd: true,
			canceledAt: new Date(),
			cancellationReason: reason
		});
	}

	/**
	 * Reactivate a canceled subscription
	 */
	async reactivateSubscription(userId: string): Promise<SubscriptionWithTier> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase
			.from('user_subscriptions')
			.update({
				cancel_at_period_end: false,
				canceled_at: null,
				cancellation_reason: null
			})
			.eq('user_id', userId)
			.select(
				`
				*,
				tier:subscription_tiers(*)
			`
			)
			.single();

		if (error) throw error;

		await this.logEvent(userId, data.id, 'subscription_updated', {
			eventType: 'subscription_updated',
			action: 'reactivated'
		});

		return data as SubscriptionWithTier;
	}

	// =========================================================================
	// Usage Summary
	// =========================================================================

	/**
	 * Get comprehensive usage summary for dashboard
	 */
	async getUsageSummary(userId: string): Promise<UsageSummary> {
		const [subscription, usageLimit] = await Promise.all([
			this.getOrCreateSubscription(userId),
			usageService.checkUsageLimit(userId)
		]);

		const percentUsed =
			usageLimit.generationLimit === -1
				? 0
				: Math.round((usageLimit.generationsUsed / usageLimit.generationLimit) * 100);

		return {
			currentPeriod: {
				start: usageLimit.resetsAt,
				end: new Date(usageLimit.resetsAt.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
				generationsUsed: usageLimit.generationsUsed,
				generationLimit: usageLimit.generationLimit,
				remaining: usageLimit.remaining,
				percentUsed
			},
			subscription: {
				tierName: subscription.tier.name,
				tierDisplayName: subscription.tier.display_name,
				status: subscription.status as SubscriptionStatus,
				billingInterval: subscription.billing_interval as BillingInterval,
				renewsAt: subscription.current_period_end
					? new Date(subscription.current_period_end)
					: null,
				cancelAtPeriodEnd: subscription.cancel_at_period_end
			},
			features: subscription.tier.features
		};
	}

	// =========================================================================
	// Helper Methods
	// =========================================================================

	/**
	 * Detect if a tier change is an upgrade or downgrade
	 */
	async detectTierChange(previousTierId: string, newTierId: string): Promise<TierChange> {
		const [previousTier, newTier] = await Promise.all([
			this.getTierById(previousTierId).catch(() => null),
			this.getTierById(newTierId)
		]);

		const previousPrice = previousTier?.price_monthly || 0;
		const newPrice = newTier.price_monthly;

		return {
			previousTier,
			newTier,
			isUpgrade: newPrice > previousPrice,
			isDowngrade: newPrice < previousPrice,
			priceDifference: newPrice - previousPrice
		};
	}

	/**
	 * Log a subscription event
	 */
	async logEvent(
		userId: string,
		subscriptionId: string,
		eventType: string,
		data: SubscriptionEventData
	): Promise<void> {
		const supabase = this.getSupabase();

		await supabase.from('subscription_events').insert({
			user_id: userId,
			subscription_id: subscriptionId,
			event_type: eventType,
			stripe_event_id: data.stripeEventId || null,
			data
		});
	}

	/**
	 * Format price in cents to display string
	 */
	private formatPrice(cents: number): string {
		if (cents === 0) return 'Free';
		return `$${(cents / 100).toFixed(2)}`;
	}

	/**
	 * Flatten tier features to a list of strings for display
	 */
	private flattenFeatures(features: Record<string, unknown>): string[] {
		const featureLabels: Record<string, string> = {
			resume_styles: 'Resume styles',
			api_access: 'API access',
			white_label: 'White-label exports',
			priority_support: 'Priority support',
			custom_branding: 'Custom branding',
			advanced_analytics: 'Advanced analytics',
			cover_letter: 'Cover letter generation',
			job_matching: 'AI job matching',
			ats_optimization: 'ATS optimization',
			linkedin_optimization: 'LinkedIn optimization',
			interview_prep: 'Interview preparation',
			salary_negotiation: 'Salary negotiation tips',
			career_coaching: 'Career coaching'
		};

		const list: string[] = [];

		for (const [key, value] of Object.entries(features)) {
			if (value === true) {
				list.push(featureLabels[key] || key);
			} else if (Array.isArray(value) && value.length > 0) {
				const styles = value.join(', ');
				list.push(`${featureLabels[key] || key}: ${styles}`);
			}
		}

		return list;
	}
}

// Export singleton instance
export const SubscriptionService = SubscriptionServiceImpl;
export const subscriptionService = new SubscriptionServiceImpl();
