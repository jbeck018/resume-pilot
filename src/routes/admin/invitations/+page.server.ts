import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { requireAdmin, AdminAccessError, isRootAdmin } from '$lib/server/auth/admin';
import { getDb, invitedUsers, profiles } from '$lib/server/database';
import { eq, desc, or, count } from 'drizzle-orm';

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

	let invitations;
	let adminCountResult;
	let rootAdmin;

	try {
		// Get all invitations
		invitations = await db
			.select()
			.from(invitedUsers)
			.orderBy(desc(invitedUsers.createdAt));

		// Get admin count (for stats)
		const adminCountResults = await db
			.select({ count: count() })
			.from(profiles)
			.where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'root_admin')));
		adminCountResult = adminCountResults[0];

		// Determine if current user is root admin
		rootAdmin = await isRootAdmin(user.id);
	} catch (err) {
		console.error('[Admin Invitations] Failed to load invitations:', err);
		throw error(500, {
			message: 'Failed to load invitations. Please try again later.',
			code: 'INVITATIONS_LOAD_FAILED'
		});
	}

	// Calculate stats
	const pendingCount = invitations.filter((inv) => inv.status === 'pending').length;
	const acceptedCount = invitations.filter((inv) => inv.status === 'accepted').length;
	const expiredCount = invitations.filter(
		(inv) => inv.status === 'pending' && new Date(inv.expiresAt) < new Date()
	).length;

	return {
		invitations: invitations.map((inv) => ({
			...inv,
			isExpired: new Date(inv.expiresAt) < new Date() && inv.status === 'pending'
		})),
		stats: {
			pending: pendingCount,
			accepted: acceptedCount,
			expired: expiredCount,
			adminCount: adminCountResult.count
		},
		isRootAdmin: rootAdmin,
		currentUserId: user.id
	};
};
