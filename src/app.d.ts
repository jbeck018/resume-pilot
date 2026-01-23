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
				// Cloudflare bindings
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
