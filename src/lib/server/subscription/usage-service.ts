/**
 * Usage Service
 *
 * Handles usage tracking and limit enforcement for the freemium system
 */

import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { UsageLimitResult, UsageIncrementResult, UsageTracking } from './types';
import { UsageLimitExceededError } from './errors';

class UsageServiceImpl {
	private getSupabase() {
		return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});
	}

	// =========================================================================
	// Week Boundary Calculations
	// =========================================================================

	/**
	 * Get the start of the week (Sunday 00:00:00 UTC)
	 */
	getWeekStart(date: Date = new Date()): Date {
		const d = new Date(date);
		const day = d.getUTCDay(); // 0 = Sunday
		d.setUTCDate(d.getUTCDate() - day);
		d.setUTCHours(0, 0, 0, 0);
		return d;
	}

	/**
	 * Get the end of the week (Saturday 23:59:59.999 UTC)
	 */
	getWeekEnd(date: Date = new Date()): Date {
		const start = this.getWeekStart(date);
		const end = new Date(start);
		end.setUTCDate(end.getUTCDate() + 7);
		end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
		return end;
	}

	// =========================================================================
	// Usage Limit Checking
	// =========================================================================

	/**
	 * Check if user can generate (has remaining quota)
	 * Uses the PostgreSQL function for atomic checking
	 */
	async checkUsageLimit(userId: string): Promise<UsageLimitResult> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase.rpc('check_generation_limit', {
			target_user_id: userId
		});

		if (error) {
			console.error('Error checking usage limit:', error);
			// Fall back to TypeScript implementation if RPC fails
			return this.checkUsageLimitFallback(userId);
		}

		const result = data?.[0];
		if (!result) {
			return this.checkUsageLimitFallback(userId);
		}

		return {
			canGenerate: result.can_generate,
			generationsUsed: result.generations_used,
			generationLimit: result.generation_limit,
			remaining: result.remaining,
			tierName: result.tier_name,
			resetsAt: new Date(result.resets_at),
			isUnlimited: result.generation_limit === -1
		};
	}

	/**
	 * Fallback implementation if RPC fails
	 */
	private async checkUsageLimitFallback(userId: string): Promise<UsageLimitResult> {
		const supabase = this.getSupabase();
		const periodStart = this.getWeekStart();
		const periodEnd = this.getWeekEnd();

		// Get user's subscription with tier
		const { data: subscription } = await supabase
			.from('user_subscriptions')
			.select(
				`
				tier:subscription_tiers(name, generation_limit_weekly)
			`
			)
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		// Default to free tier limits
		// Supabase returns joined relations as arrays, access first element
		const tier = Array.isArray(subscription?.tier) ? subscription.tier[0] : subscription?.tier;
		const tierName = tier?.name || 'free';
		const generationLimit = tier?.generation_limit_weekly ?? 5;

		// Get current usage
		const { data: usage } = await supabase
			.from('usage_tracking')
			.select('generations_used')
			.eq('user_id', userId)
			.eq('period_start', periodStart.toISOString())
			.single();

		const generationsUsed = usage?.generations_used ?? 0;
		const isUnlimited = generationLimit === -1;
		const remaining = isUnlimited ? -1 : Math.max(0, generationLimit - generationsUsed);
		const canGenerate = isUnlimited || generationsUsed < generationLimit;

		return {
			canGenerate,
			generationsUsed,
			generationLimit,
			remaining,
			tierName,
			resetsAt: periodEnd,
			isUnlimited
		};
	}

	/**
	 * Check limit and throw if exceeded
	 */
	async enforceUsageLimit(userId: string): Promise<UsageLimitResult> {
		const result = await this.checkUsageLimit(userId);

		if (!result.canGenerate) {
			throw new UsageLimitExceededError(result.remaining, result.generationLimit, result.resetsAt);
		}

		return result;
	}

	// =========================================================================
	// Usage Tracking
	// =========================================================================

	/**
	 * Increment usage counter
	 * Uses the PostgreSQL function for atomic increment
	 */
	async incrementUsage(
		userId: string,
		type: 'generation' | 'job_discovery' | 'api_call' = 'generation',
		amount: number = 1
	): Promise<UsageIncrementResult> {
		const supabase = this.getSupabase();

		const { data, error } = await supabase.rpc('increment_usage', {
			target_user_id: userId,
			usage_type: type,
			increment_by: amount
		});

		if (error) {
			console.error('Error incrementing usage:', error);
			// Fall back to TypeScript implementation
			return this.incrementUsageFallback(userId, type, amount);
		}

		const result = data?.[0];
		if (!result) {
			return this.incrementUsageFallback(userId, type, amount);
		}

		return {
			success: result.success,
			newCount: result.new_count,
			limitReached: result.limit_reached
		};
	}

	/**
	 * Fallback implementation for incrementing usage
	 */
	private async incrementUsageFallback(
		userId: string,
		type: 'generation' | 'job_discovery' | 'api_call',
		amount: number
	): Promise<UsageIncrementResult> {
		const supabase = this.getSupabase();
		const periodStart = this.getWeekStart();
		const periodEnd = this.getWeekEnd();

		// Get current usage
		const { data: existing } = await supabase
			.from('usage_tracking')
			.select('*')
			.eq('user_id', userId)
			.eq('period_start', periodStart.toISOString())
			.single();

		const columnMap = {
			generation: 'generations_used',
			job_discovery: 'jobs_discovered',
			api_call: 'api_calls'
		};

		const column = columnMap[type];
		const currentValue = existing?.[column as keyof UsageTracking] as number ?? 0;
		const newValue = currentValue + amount;

		if (existing) {
			// Update existing record
			await supabase
				.from('usage_tracking')
				.update({ [column]: newValue })
				.eq('id', existing.id);
		} else {
			// Insert new record
			await supabase.from('usage_tracking').insert({
				user_id: userId,
				period_start: periodStart.toISOString(),
				period_end: periodEnd.toISOString(),
				[column]: newValue
			});
		}

		// Check if limit reached
		const limit = await this.checkUsageLimit(userId);

		return {
			success: true,
			newCount: newValue,
			limitReached: !limit.canGenerate
		};
	}

	/**
	 * Record a generation and check/enforce limit
	 * This is the main function to call before generating content
	 */
	async recordGeneration(userId: string): Promise<{
		allowed: boolean;
		usage: UsageLimitResult;
	}> {
		// First check if user can generate
		const usageCheck = await this.checkUsageLimit(userId);

		if (!usageCheck.canGenerate) {
			return {
				allowed: false,
				usage: usageCheck
			};
		}

		// Increment usage
		await this.incrementUsage(userId, 'generation');

		// Return updated usage
		const updatedUsage = await this.checkUsageLimit(userId);

		return {
			allowed: true,
			usage: updatedUsage
		};
	}

	// =========================================================================
	// Usage History
	// =========================================================================

	/**
	 * Get usage history for a user
	 */
	async getUsageHistory(
		userId: string,
		options: { limit?: number; offset?: number } = {}
	): Promise<UsageTracking[]> {
		const supabase = this.getSupabase();
		const { limit = 10, offset = 0 } = options;

		const { data, error } = await supabase
			.from('usage_tracking')
			.select('*')
			.eq('user_id', userId)
			.order('period_start', { ascending: false })
			.range(offset, offset + limit - 1);

		if (error) throw error;
		return data || [];
	}

	/**
	 * Get current period usage
	 */
	async getCurrentPeriodUsage(userId: string): Promise<UsageTracking | null> {
		const supabase = this.getSupabase();
		const periodStart = this.getWeekStart();

		const { data, error } = await supabase
			.from('usage_tracking')
			.select('*')
			.eq('user_id', userId)
			.eq('period_start', periodStart.toISOString())
			.single();

		if (error && error.code !== 'PGRST116') throw error; // Ignore not found
		return data || null;
	}

	// =========================================================================
	// Remaining Generations Helper
	// =========================================================================

	/**
	 * Get remaining generations for a user
	 * Convenience method for UI display
	 */
	async getRemainingGenerations(userId: string): Promise<number> {
		const limit = await this.checkUsageLimit(userId);
		return limit.remaining;
	}

	/**
	 * Check if user has any remaining generations
	 */
	async hasRemainingGenerations(userId: string): Promise<boolean> {
		const limit = await this.checkUsageLimit(userId);
		return limit.canGenerate;
	}
}

// Export singleton instance
export const UsageService = UsageServiceImpl;
export const usageService = new UsageServiceImpl();
