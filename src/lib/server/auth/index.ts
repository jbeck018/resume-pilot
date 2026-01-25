/**
 * Auth Module
 *
 * Exports authentication and authorization utilities for the resume-pilot app.
 */

export {
	// Constants
	ROOT_ADMIN_EMAIL,

	// Error classes
	AdminAccessError,

	// Core functions
	getUserRole,
	getUserRoleByEmail,
	isAdmin,
	isRootAdmin,
	isRegularUser,

	// Guard functions
	requireAdmin,
	requireRootAdmin,
	requireAdminSync,

	// Role management
	updateUserRole,
	grantAdminRole,
	revokeAdminRole,

	// Admin profile helpers
	getAdminProfile,
	listAdmins,

	// Utilities
	isRootAdminEmail,
	createAdminContext,

	// Types
	type AdminContext
} from './admin';
