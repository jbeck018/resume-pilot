import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { requireAdmin, AdminAccessError, isRootAdmin } from '$lib/server/auth/admin';
import { getDb, profiles } from '$lib/server/database';
import { desc, or, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		redirect(303, '/auth/login');
	}

	try {
		await requireAdmin(user.id, user.email ?? undefined);
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw e;
	}

	const db = getDb();

	let users;
	let rootAdmin;

	try {
		// Get all users
		users = await db
			.select({
				id: profiles.id,
				userId: profiles.userId,
				email: profiles.email,
				fullName: profiles.fullName,
				role: profiles.role,
				createdAt: profiles.createdAt,
				updatedAt: profiles.updatedAt
			})
			.from(profiles)
			.orderBy(desc(profiles.createdAt));

		// Check if current user is root admin
		rootAdmin = await isRootAdmin(user.id);
	} catch (err) {
		console.error('[Admin Users] Failed to load users:', err);
		throw error(500, {
			message: 'Failed to load user list. Please try again later.',
			code: 'USERS_LOAD_FAILED'
		});
	}

	// Calculate stats
	const totalUsers = users.length;
	const adminCount = users.filter(
		(u) => u.role === 'admin' || u.role === 'root_admin'
	).length;
	const regularCount = users.filter((u) => u.role === 'user').length;

	return {
		users,
		stats: {
			total: totalUsers,
			admins: adminCount,
			regular: regularCount
		},
		isRootAdmin: rootAdmin,
		currentUserId: user.id
	};
};
