import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, requireRootAdmin, isRootAdmin, AdminAccessError } from '$lib/server/auth/admin';
import { getDb, invitedUsers } from '$lib/server/database';
import { eq, and, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { UserRole, InvitationStatus } from '$lib/server/database/schema';

/**
 * Generate a secure invitation token
 */
function generateInvitationToken(): string {
	return randomBytes(32).toString('hex');
}

/**
 * GET /api/admin/invitations
 * List all invitations
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw error(401, 'Authentication required');
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

	const invitations = await db
		.select()
		.from(invitedUsers)
		.orderBy(desc(invitedUsers.createdAt));

	return json({
		success: true,
		invitations: invitations.map((inv) => ({
			...inv,
			// Add computed fields
			isExpired: new Date(inv.expiresAt) < new Date() && inv.status === 'pending',
			invitationUrl: `/invite/${inv.token}`
		}))
	});
};

/**
 * POST /api/admin/invitations
 * Create a new invitation
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw error(401, 'Authentication required');
	}

	try {
		await requireAdmin(user.id, user.email ?? undefined);
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw e;
	}

	const body = await request.json();
	const { email, role } = body as { email: string; role?: UserRole };

	// Validate email
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		throw error(400, 'Valid email is required');
	}

	// Validate role
	const targetRole: UserRole = role || 'user';
	if (!['user', 'admin'].includes(targetRole)) {
		throw error(400, 'Invalid role. Must be "user" or "admin"');
	}

	// Only root admin can invite admins
	if (targetRole === 'admin') {
		const isRoot = await isRootAdmin(user.id);
		if (!isRoot) {
			throw error(403, 'Only root admin can invite admin users');
		}
	}

	const db = getDb();

	// Check if invitation already exists for this email
	const existingInvitation = await db
		.select()
		.from(invitedUsers)
		.where(
			and(
				eq(invitedUsers.email, email.toLowerCase()),
				eq(invitedUsers.status, 'pending')
			)
		)
		.limit(1);

	if (existingInvitation.length > 0) {
		throw error(409, 'A pending invitation already exists for this email');
	}

	// Check if user already has an account
	const { data: existingProfile } = await locals.supabase
		.from('profiles')
		.select('id')
		.eq('email', email.toLowerCase())
		.single();

	if (existingProfile) {
		throw error(409, 'A user with this email already exists');
	}

	// Create invitation
	const token = generateInvitationToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

	const [newInvitation] = await db
		.insert(invitedUsers)
		.values({
			email: email.toLowerCase(),
			role: targetRole,
			token,
			invitedBy: user.id,
			invitedByEmail: user.email ?? null,
			status: 'pending',
			expiresAt
		})
		.returning();

	// Generate the full invitation URL
	const invitationUrl = `${url.origin}/invite/${token}`;

	return json({
		success: true,
		invitation: {
			...newInvitation,
			invitationUrl
		}
	});
};

/**
 * DELETE /api/admin/invitations
 * Revoke an invitation
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw error(401, 'Authentication required');
	}

	try {
		await requireAdmin(user.id, user.email ?? undefined);
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw e;
	}

	const body = await request.json();
	const { id } = body as { id: string };

	if (!id) {
		throw error(400, 'Invitation ID is required');
	}

	const db = getDb();

	// Check if invitation exists
	const [invitation] = await db
		.select()
		.from(invitedUsers)
		.where(eq(invitedUsers.id, id))
		.limit(1);

	if (!invitation) {
		throw error(404, 'Invitation not found');
	}

	// Can't revoke already accepted or already revoked invitations
	if (invitation.status !== 'pending') {
		throw error(400, `Cannot revoke invitation with status: ${invitation.status}`);
	}

	// If the invitation is for an admin, only root admin can revoke
	if (invitation.role === 'admin') {
		const isRoot = await isRootAdmin(user.id);
		if (!isRoot) {
			throw error(403, 'Only root admin can revoke admin invitations');
		}
	}

	// Revoke the invitation
	await db
		.update(invitedUsers)
		.set({ status: 'revoked' as InvitationStatus })
		.where(eq(invitedUsers.id, id));

	return json({ success: true });
};

/**
 * PATCH /api/admin/invitations
 * Resend/refresh an invitation (regenerate token and reset expiry)
 */
export const PATCH: RequestHandler = async ({ request, locals, url }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw error(401, 'Authentication required');
	}

	try {
		await requireAdmin(user.id, user.email ?? undefined);
	} catch (e) {
		if (e instanceof AdminAccessError) {
			throw error(403, e.message);
		}
		throw e;
	}

	const body = await request.json();
	const { id } = body as { id: string };

	if (!id) {
		throw error(400, 'Invitation ID is required');
	}

	const db = getDb();

	// Check if invitation exists
	const [invitation] = await db
		.select()
		.from(invitedUsers)
		.where(eq(invitedUsers.id, id))
		.limit(1);

	if (!invitation) {
		throw error(404, 'Invitation not found');
	}

	// Can only resend pending invitations
	if (invitation.status !== 'pending') {
		throw error(400, `Cannot resend invitation with status: ${invitation.status}`);
	}

	// Generate new token and expiry
	const token = generateInvitationToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);

	const [updatedInvitation] = await db
		.update(invitedUsers)
		.set({ token, expiresAt })
		.where(eq(invitedUsers.id, id))
		.returning();

	const invitationUrl = `${url.origin}/invite/${token}`;

	return json({
		success: true,
		invitation: {
			...updatedInvitation,
			invitationUrl
		}
	});
};
