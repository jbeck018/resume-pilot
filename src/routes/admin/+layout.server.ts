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
				error(500, {
					message: 'Database configuration error. Please contact system administrator.',
					code: 'DB_CONFIG_ERROR'
				});
			} else if (err.message.includes('connection') || err.message.includes('ECONNREFUSED')) {
				error(500, {
					message: 'Database connection failed. Please try again later.',
					code: 'DB_CONNECTION_ERROR'
				});
			}
		}

		// Generic database error
		error(500, {
			message: 'Failed to verify admin access. Please try again later.',
			code: 'ADMIN_CHECK_FAILED'
		});
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
