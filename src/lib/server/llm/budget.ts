// Budget Enforcement Middleware
// Checks user budget before LLM calls and records usage after

import { db } from '../database';
import { sql } from 'drizzle-orm';

export interface BudgetCheck {
	allowed: boolean;
	remainingCents: number;
	usagePercent: number;
	message: string | null;
}

export interface UsageRecord {
	userId: string;
	model: string;
	provider: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	costCents: number;
	purpose?: string;
	jobId?: string;
	traceId?: string;
	cached?: boolean;
	metadata?: Record<string, unknown>;
}

// Check if user has budget remaining before making LLM call
export async function checkBudget(userId: string): Promise<BudgetCheck> {
	const result = await db.execute(sql`SELECT * FROM check_budget(${userId})`);

	const row = result[0] as {
		allowed: boolean;
		remaining_cents: string;
		usage_percent: string;
		message: string | null;
	};

	return {
		allowed: row.allowed,
		remainingCents: parseFloat(row.remaining_cents),
		usagePercent: parseFloat(row.usage_percent),
		message: row.message
	};
}

// Record token usage after LLM call
export async function recordUsage(usage: UsageRecord): Promise<void> {
	await db.execute(sql`
    INSERT INTO token_usage (
      user_id, model, provider,
      prompt_tokens, completion_tokens, total_tokens,
      cost_cents, purpose, job_id, trace_id, cached, metadata
    ) VALUES (
      ${usage.userId}::uuid,
      ${usage.model},
      ${usage.provider},
      ${usage.promptTokens},
      ${usage.completionTokens},
      ${usage.totalTokens},
      ${usage.costCents},
      ${usage.purpose || null},
      ${usage.jobId ? sql`${usage.jobId}::uuid` : null},
      ${usage.traceId || null},
      ${usage.cached || false},
      ${JSON.stringify(usage.metadata || {})}::jsonb
    )
  `);
}

// Get user's current usage summary
export async function getCurrentUsage(userId: string): Promise<{
	periodStart: Date;
	usedCents: number;
	budgetCents: number;
	remainingCents: number;
	usagePercent: number;
}> {
	const result = await db.execute(sql`
    SELECT
      current_period_start,
      current_period_usage_cents,
      monthly_budget_cents
    FROM user_budgets
    WHERE user_id = ${userId}::uuid
  `);

	if (result.length === 0) {
		// Create default budget
		await db.execute(sql`
      INSERT INTO user_budgets (user_id)
      VALUES (${userId}::uuid)
      ON CONFLICT (user_id) DO NOTHING
    `);
		return {
			periodStart: new Date(),
			usedCents: 0,
			budgetCents: 10000,
			remainingCents: 10000,
			usagePercent: 0
		};
	}

	const row = result[0] as {
		current_period_start: Date;
		current_period_usage_cents: string;
		monthly_budget_cents: number;
	};

	const usedCents = parseFloat(row.current_period_usage_cents);
	const budgetCents = row.monthly_budget_cents;

	return {
		periodStart: row.current_period_start,
		usedCents,
		budgetCents,
		remainingCents: budgetCents - usedCents,
		usagePercent: (usedCents / budgetCents) * 100
	};
}

// Get daily usage breakdown
export async function getDailyUsage(
	userId: string,
	days: number = 30
): Promise<
	Array<{
		date: Date;
		requests: number;
		tokens: number;
		costCents: number;
		byModel: Record<string, { requests: number; tokens: number; cost: number }>;
		byPurpose: Record<string, { requests: number; tokens: number; cost: number }>;
	}>
> {
	const result = await db.execute(sql`
    SELECT
      usage_date,
      total_requests,
      total_tokens,
      total_cost_cents,
      usage_by_model,
      usage_by_purpose
    FROM daily_usage_summary
    WHERE user_id = ${userId}::uuid
      AND usage_date >= CURRENT_DATE - ${days}::interval
    ORDER BY usage_date DESC
  `);

	type DailyUsageRow = {
		usage_date: Date;
		total_requests: number;
		total_tokens: number;
		total_cost_cents: string;
		usage_by_model: Record<string, { requests: number; tokens: number; cost: number }>;
		usage_by_purpose: Record<string, { requests: number; tokens: number; cost: number }>;
	};

	return (result as unknown as DailyUsageRow[]).map((row) => ({
		date: row.usage_date,
		requests: row.total_requests,
		tokens: row.total_tokens,
		costCents: parseFloat(row.total_cost_cents),
		byModel: row.usage_by_model,
		byPurpose: row.usage_by_purpose
	}));
}

// Update user's budget limit
export async function updateBudget(
	userId: string,
	budgetCents: number
): Promise<void> {
	await db.execute(sql`
    UPDATE user_budgets
    SET monthly_budget_cents = ${budgetCents}, updated_at = NOW()
    WHERE user_id = ${userId}::uuid
  `);
}

// Budget exceeded error
export class BudgetExceededError extends Error {
	constructor(
		public budgetCheck: BudgetCheck
	) {
		super(budgetCheck.message || 'Budget exceeded');
		this.name = 'BudgetExceededError';
	}
}

// Helper to extract provider from model name
export function getProviderFromModel(model: string): string {
	if (model.startsWith('claude')) return 'anthropic';
	if (model.startsWith('gpt')) return 'openai';
	if (model.startsWith('gemini')) return 'google';
	return 'unknown';
}
