import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, invitedUsers, profiles } from '$lib/server/database';
import { eq, and } from 'drizzle-orm';
import type { InvitationStatus, UserRole } from '$lib/server/database/schema';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/dashboard';
	const invitationToken = url.searchParams.get('invitation_token');

	if (code) {
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data.user) {
			// If there's an invitation token, process it
			if (invitationToken) {
				try {
					const db = getDb();

					// Find the invitation
					const [invitation] = await db
						.select()
						.from(invitedUsers)
						.where(
							and(
								eq(invitedUsers.token, invitationToken),
								eq(invitedUsers.status, 'pending')
							)
						)
						.limit(1);

					// If valid invitation exists, update user role and mark accepted
					if (
						invitation &&
						invitation.email.toLowerCase() === data.user.email?.toLowerCase() &&
						new Date(invitation.expiresAt) > new Date()
					) {
						// Update the user's profile with the invited role
						await db
							.update(profiles)
							.set({ role: invitation.role as UserRole })
							.where(eq(profiles.userId, data.user.id));

						// Mark invitation as accepted
						await db
							.update(invitedUsers)
							.set({
								status: 'accepted' as InvitationStatus,
								acceptedAt: new Date(),
								acceptedBy: data.user.id
							})
							.where(eq(invitedUsers.id, invitation.id));
					}
				} catch (e) {
					// Log error but don't fail the auth flow
					console.error('Error processing invitation token:', e);
				}
			}

			redirect(303, next);
		}
	}

	// Return to login page on error
	redirect(303, '/auth/login?error=auth_callback_error');
};
