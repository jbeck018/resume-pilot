/**
 * Admin Authentication and Authorization Middleware
 *
 * Provides functions for checking admin status and protecting admin routes.
 * Uses the user_role enum from the database: 'user' | 'admin' | 'root_admin'
 */

import { error } from '@sveltejs/kit';
import { eq, or } from 'drizzle-orm';
import { getDb, profiles } from '../database';
import type { UserRole } from '../database/schema';

// ============================================================================
// Constants
// ============================================================================

/**
 * The root admin email - this user has full system access
 */
export const ROOT_ADMIN_EMAIL = 'jacobbeck.dev@gmail.com';

// ============================================================================
// Error Classes
// ============================================================================

export class AdminAccessError extends Error {
	constructor(
		message: string,
		public code: 'NOT_AUTHENTICATED' | 'NOT_ADMIN' | 'NOT_ROOT_ADMIN' | 'INSUFFICIENT_PERMISSIONS'
	) {
		super(message);
		this.name = 'AdminAccessError';
	}
}

// ============================================================================
// Core Admin Check Functions
// ============================================================================

/**
 * Get the role of a user by their Supabase auth user ID
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
	try {
		const db = getDb();

		const result = await db
			.select({ role: profiles.role })
			.from(profiles)
			.where(eq(profiles.userId, userId))
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		return result[0].role as UserRole;
	} catch (error) {
		console.error('[Admin] Failed to fetch user role:', error instanceof Error ? error.message : String(error));
		throw error; // Re-throw so caller can handle
	}
}

/**
 * Get the role of a user by their email address
 */
export async function getUserRoleByEmail(email: string): Promise<UserRole | null> {
	const db = getDb();

	const result = await db
		.select({ role: profiles.role })
		.from(profiles)
		.where(eq(profiles.email, email.toLowerCase()))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	return result[0].role as UserRole;
}

/**
 * Check if a user is an admin (either admin or root_admin)
 * @param userId - The Supabase auth user ID
 * @param email - Optional email for fallback check (legacy support)
 */
export async function isAdmin(userId: string, email?: string): Promise<boolean> {
	try {
		const role = await getUserRole(userId);

		// Check by role
		if (role === 'admin' || role === 'root_admin') {
			return true;
		}
	} catch (error) {
		console.error('[Admin] Error checking user role in isAdmin():', error);
		// Fall through to legacy check
	}

	// Legacy fallback: check by email for root admin
	if (email && isRootAdminEmail(email)) {
		return true;
	}

	return false;
}

/**
 * Check if a user is a root admin
 */
export async function isRootAdmin(userId: string): Promise<boolean> {
	const role = await getUserRole(userId);
	return role === 'root_admin';
}

/**
 * Check if a user is a regular user (not admin)
 */
export async function isRegularUser(userId: string): Promise<boolean> {
	const role = await getUserRole(userId);
	return role === 'user' || role === null;
}

// ============================================================================
// Guard Functions (throw on failure)
// ============================================================================

/**
 * Require that the user is an admin. Throws AdminAccessError if not.
 * @throws {AdminAccessError} If user is not an admin
 */
export async function requireAdmin(userId: string, email?: string): Promise<void> {
	if (!userId) {
		throw new AdminAccessError('Authentication required', 'NOT_AUTHENTICATED');
	}

	const admin = await isAdmin(userId, email);
	if (!admin) {
		throw new AdminAccessError('Admin access required', 'NOT_ADMIN');
	}
}

/**
 * Require that the user is a root admin. Throws AdminAccessError if not.
 * @throws {AdminAccessError} If user is not a root admin
 */
export async function requireRootAdmin(userId: string): Promise<void> {
	if (!userId) {
		throw new AdminAccessError('Authentication required', 'NOT_AUTHENTICATED');
	}

	const rootAdmin = await isRootAdmin(userId);
	if (!rootAdmin) {
		throw new AdminAccessError('Root admin access required', 'NOT_ROOT_ADMIN');
	}
}

/**
 * Require admin access or throw a SvelteKit 403 error (legacy API)
 */
export function requireAdminSync(userId: string, email?: string): void {
	// Synchronous check only using email
	if (email && isRootAdminEmail(email)) {
		return;
	}
	throw error(403, 'Access denied. Admin privileges required.');
}

// ============================================================================
// Role Management Functions
// ============================================================================

/**
 * Update a user's role (only root admins can do this)
 * @param requestingUserId The user ID of the admin making the change
 * @param targetUserId The user ID whose role is being changed
 * @param newRole The new role to assign
 * @throws {AdminAccessError} If the requesting user doesn't have permission
 */
export async function updateUserRole(
	requestingUserId: string,
	targetUserId: string,
	newRole: UserRole
): Promise<void> {
	// Only root admins can change roles
	await requireRootAdmin(requestingUserId);

	// Prevent demoting yourself from root_admin
	if (requestingUserId === targetUserId && newRole !== 'root_admin') {
		throw new AdminAccessError('Cannot demote yourself from root admin', 'INSUFFICIENT_PERMISSIONS');
	}

	const db = getDb();

	await db.update(profiles).set({ role: newRole }).where(eq(profiles.userId, targetUserId));
}

/**
 * Grant admin role to a user
 */
export async function grantAdminRole(
	requestingUserId: string,
	targetUserId: string
): Promise<void> {
	await updateUserRole(requestingUserId, targetUserId, 'admin');
}

/**
 * Revoke admin role from a user (demote to regular user)
 */
export async function revokeAdminRole(
	requestingUserId: string,
	targetUserId: string
): Promise<void> {
	// Get current role to ensure we don't demote a root_admin via this function
	const currentRole = await getUserRole(targetUserId);

	if (currentRole === 'root_admin') {
		throw new AdminAccessError(
			'Cannot revoke root admin role via this function',
			'INSUFFICIENT_PERMISSIONS'
		);
	}

	await updateUserRole(requestingUserId, targetUserId, 'user');
}

// ============================================================================
// Admin Profile Helpers
// ============================================================================

/**
 * Get full profile with role for an admin user
 */
export async function getAdminProfile(userId: string) {
	const db = getDb();

	const result = await db
		.select({
			id: profiles.id,
			userId: profiles.userId,
			email: profiles.email,
			fullName: profiles.fullName,
			role: profiles.role,
			createdAt: profiles.createdAt
		})
		.from(profiles)
		.where(eq(profiles.userId, userId))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const profile = result[0];

	// Check if admin
	if (profile.role !== 'admin' && profile.role !== 'root_admin') {
		return null;
	}

	return profile;
}

/**
 * List all admin users
 */
export async function listAdmins(): Promise<
	Array<{
		id: string;
		userId: string;
		email: string;
		fullName: string | null;
		role: UserRole;
		createdAt: Date;
	}>
> {
	const db = getDb();

	const result = await db
		.select({
			id: profiles.id,
			userId: profiles.userId,
			email: profiles.email,
			fullName: profiles.fullName,
			role: profiles.role,
			createdAt: profiles.createdAt
		})
		.from(profiles)
		.where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'root_admin')))
		.orderBy(profiles.createdAt);

	return result.map((r) => ({ ...r, role: r.role as UserRole }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an email is the root admin email
 */
export function isRootAdminEmail(email: string): boolean {
	return email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
}

/**
 * Create an admin context object for use in server-side code
 */
export async function createAdminContext(userId: string) {
	const role = await getUserRole(userId);
	const admin = role === 'admin' || role === 'root_admin';
	const rootAdmin = role === 'root_admin';

	return {
		userId,
		role: role ?? 'user',
		isAdmin: admin,
		isRootAdmin: rootAdmin,
		canManageUsers: admin,
		canManageInvitations: admin,
		canManageWaitlist: admin,
		canViewActivityLog: admin,
		canManageRoles: rootAdmin,
		canAccessSystemSettings: rootAdmin
	};
}

export type AdminContext = Awaited<ReturnType<typeof createAdminContext>>;
