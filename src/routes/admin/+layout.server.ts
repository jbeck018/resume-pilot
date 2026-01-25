import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		redirect(303, '/auth/login');
	}

	// Check if user is an admin
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('user_id', user.id)
		.single<{ role: string }>();

	if (!profile || !['admin', 'root_admin'].includes(profile.role)) {
		redirect(303, '/dashboard');
	}

	return {
		session,
		user,
		isRootAdmin: profile.role === 'root_admin',
		userRole: profile.role as 'admin' | 'root_admin'
	};
};
