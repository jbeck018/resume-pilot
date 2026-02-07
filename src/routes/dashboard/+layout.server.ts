import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/auth/admin';

export const load: LayoutServerLoad = async ({ locals: { user } }) => {
	let isAdminUser = false;

	if (user) {
		try {
			isAdminUser = await isAdmin(user.id, user.email ?? undefined);
		} catch (error) {
			console.error('Error checking admin status:', error);
			// Default to false on error - user is not admin
			isAdminUser = false;
		}
	}

	return {
		isAdmin: isAdminUser
	};
};
