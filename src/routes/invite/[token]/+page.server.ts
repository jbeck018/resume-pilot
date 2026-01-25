import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getDb, invitedUsers } from '$lib/server/database';
import { eq, and } from 'drizzle-orm';
import type { InvitationStatus } from '$lib/server/database/schema';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { token } = params;

	// Check if user is already logged in
	const { session } = await locals.safeGetSession();
	if (session) {
		// User is already logged in, redirect to dashboard
		redirect(303, '/dashboard');
	}

	const db = getDb();

	// Find the invitation
	const [invitation] = await db
		.select()
		.from(invitedUsers)
		.where(eq(invitedUsers.token, token))
		.limit(1);

	if (!invitation) {
		return {
			valid: false,
			error: 'Invitation not found',
			invitation: null
		};
	}

	// Check if invitation is expired
	if (new Date(invitation.expiresAt) < new Date()) {
		return {
			valid: false,
			error: 'This invitation has expired',
			invitation: null
		};
	}

	// Check invitation status
	if (invitation.status === 'revoked') {
		return {
			valid: false,
			error: 'This invitation has been revoked',
			invitation: null
		};
	}

	if (invitation.status === 'accepted') {
		return {
			valid: false,
			error: 'This invitation has already been used',
			invitation: null
		};
	}

	return {
		valid: true,
		error: null,
		invitation: {
			email: invitation.email,
			role: invitation.role,
			invitedBy: invitation.invitedByEmail
		}
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals, url }) => {
		const { token } = params;
		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		const db = getDb();

		// Find the invitation again (re-validate)
		const [invitation] = await db
			.select()
			.from(invitedUsers)
			.where(eq(invitedUsers.token, token))
			.limit(1);

		if (!invitation) {
			return fail(400, { error: 'Invitation not found' });
		}

		if (new Date(invitation.expiresAt) < new Date()) {
			return fail(400, { error: 'This invitation has expired' });
		}

		if (invitation.status !== 'pending') {
			return fail(400, { error: `This invitation is ${invitation.status}` });
		}

		// Create the user account with Supabase Auth
		const { data: authData, error: authError } = await locals.supabase.auth.signUp({
			email: invitation.email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
				data: {
					invited_role: invitation.role,
					invitation_id: invitation.id
				}
			}
		});

		if (authError) {
			return fail(400, { error: authError.message });
		}

		// Note: The invitation will be marked as accepted by the database trigger
		// when the user's profile is created (handle_new_user function)

		return { success: true, needsEmailConfirmation: true };
	},

	oauth: async ({ request, params, locals, url }) => {
		const { token } = params;
		const formData = await request.formData();
		const provider = formData.get('provider') as 'google' | 'github';

		const db = getDb();

		// Validate invitation exists
		const [invitation] = await db
			.select()
			.from(invitedUsers)
			.where(eq(invitedUsers.token, token))
			.limit(1);

		if (!invitation || invitation.status !== 'pending' || new Date(invitation.expiresAt) < new Date()) {
			return fail(400, { error: 'Invalid or expired invitation' });
		}

		// Store the invitation token in the session for OAuth callback to use
		// The callback will need to handle marking the invitation as accepted

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${url.origin}/auth/callback?invitation_token=${token}`,
				queryParams: {
					// Hint the email to the OAuth provider
					login_hint: invitation.email
				}
			}
		});

		if (error) {
			return fail(400, { error: error.message });
		}

		if (data.url) {
			redirect(303, data.url);
		}

		return fail(500, { error: 'Failed to start OAuth flow' });
	}
};
