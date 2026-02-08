import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserRole, AdminAccessError } from '$lib/server/auth/admin';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		redirect(303, '/auth/login');
	}

	let role;
	try {
		// Check if user is an admin using Drizzle (consistent with other admin routes)
		role = await getUserRole(user.id);
	} catch (err) {
		// Log the actual error for debugging
		console.error('[Admin Layout] Failed to fetch user role:', err);

		// If database is unavailable, return 500 with helpful message
		if (err instanceof Error) {
			if (err.message.includes('SUPABASE_DB_URL')) {
				error(500, 'Database configuration error. Please contact system administrator.');
			} else if (err.message.includes('connection') || err.message.includes('ECONNREFUSED')) {
				error(500, 'Database connection failed. Please try again later.');
			}
		}

		// Generic database error
		error(500, 'Failed to verify admin access. Please try again later.');
	}

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
