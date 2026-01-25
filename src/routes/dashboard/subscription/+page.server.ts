import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	return {
		user: user
			? {
					id: user.id,
					email: user.email
				}
			: null
	};
};
