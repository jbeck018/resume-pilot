import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session, user } = await safeGetSession();

	return {
		session,
		user,
		cookies: cookies.getAll(),
		supabaseUrl: env.PUBLIC_SUPABASE_URL!,
		supabaseAnonKey: env.PUBLIC_SUPABASE_ANON_KEY!
	};
};
