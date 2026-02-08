// Supabase client factory for Cloudflare Workflows
// Each step should create its own client to avoid CPU overhead between steps

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@howlerhire/database-types';
import type { Env } from '../types';

/**
 * Creates a typed Supabase client for use within a workflow step.
 * The Database generic ensures column names are checked at compile time.
 * IMPORTANT: Call this INSIDE each step.do() block, not at the workflow level.
 * This avoids CPU overhead accumulation between step hibernations.
 */
export function createSupabaseClient(env: Env) {
	return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}
