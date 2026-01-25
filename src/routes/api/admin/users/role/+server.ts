import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRootAdmin, updateUserRole, AdminAccessError } from '$lib/server/auth/admin';
import type { UserRole } from '$lib/server/database/schema';

/**
 * POST /api/admin/users/role
 * Change a user's role (only root admin can do this)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw error(401, 'Authentication required');
	}

	try {
		await requireRootAdmin(user.id);
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw e;
	}

	const body = await request.json();
	const { userId, role } = body as { userId: string; role: UserRole };

	// Validate input
	if (!userId || typeof userId !== 'string') {
		throw error(400, 'User ID is required');
	}

	if (!role || !['user', 'admin'].includes(role)) {
		throw error(400, 'Invalid role. Must be "user" or "admin"');
	}

	// Prevent changing to root_admin via this endpoint
	if (role === 'root_admin') {
		throw error(400, 'Cannot assign root_admin role via this endpoint');
	}

	// Prevent changing your own role
	if (userId === user.id) {
		throw error(400, 'Cannot change your own role');
	}

	try {
		await updateUserRole(user.id, userId, role);
		return json({ success: true });
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw error(500, 'Failed to update user role');
	}
};
