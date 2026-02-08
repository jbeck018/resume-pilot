import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/ssr';
import type { Database } from '$lib/server/database/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
		interface Platform {
			env?: {
				// Cloudflare environment variables
				SUPABASE_URL?: string;
				SUPABASE_ANON_KEY?: string;
				SUPABASE_SERVICE_ROLE_KEY?: string;
				ANTHROPIC_API_KEY?: string;
				LANGFUSE_SECRET_KEY?: string;
				LANGFUSE_PUBLIC_KEY?: string;
				LANGFUSE_BASEURL?: string;
				RESEND_API_KEY?: string;
				SENTRY_DSN?: string;
				// Allow other string keys
				[key: string]: string | undefined;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
