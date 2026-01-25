import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/auth/admin';

export const load: LayoutServerLoad = async ({ locals: { user } }) => {
	return {
		isAdmin: user ? await isAdmin(user.id, user.email ?? undefined) : false
	};
};
