import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	const { supabaseUrl, supabaseAnonKey } = data;

	const supabase = isBrowser()
		? createBrowserClient(supabaseUrl, supabaseAnonKey, {
				global: { fetch }
			})
		: createServerClient(supabaseUrl, supabaseAnonKey, {
				global: { fetch },
				cookies: {
					getAll() {
						return data.cookies;
					}
				}
			});

	const {
		data: { session }
	} = await supabase.auth.getSession();

	const {
		data: { user }
	} = await supabase.auth.getUser();

	return { session, supabase, user };
};
