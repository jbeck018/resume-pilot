// Supabase client factory for Cloudflare Workflows
// Each step should create its own client to avoid CPU overhead between steps

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

/**
 * Creates a Supabase client for use within a workflow step.
 * IMPORTANT: Call this INSIDE each step.do() block, not at the workflow level.
 * This avoids CPU overhead accumulation between step hibernations.
 */
export function createSupabaseClient(env: Env): SupabaseClient {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}

/**
 * Type-safe wrapper for Supabase operations with error handling
 */
export async function withSupabase<T>(
	env: Env,
	operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
	const client = createSupabaseClient(env);
	return operation(client);
}
