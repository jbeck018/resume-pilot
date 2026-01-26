import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserRole } from '$lib/server/auth/admin';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		redirect(303, '/auth/login');
	}

	// Check if user is an admin using Drizzle (consistent with other admin routes)
	const role = await getUserRole(user.id);

	if (!role || !['admin', 'root_admin'].includes(role)) {
		redirect(303, '/dashboard');
	}

	return {
		session,
		user,
		isRootAdmin: role === 'root_admin',
		userRole: role as 'admin' | 'root_admin'
	};
};
