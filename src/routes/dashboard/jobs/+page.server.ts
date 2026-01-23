import type { PageServerLoad } from './$types';
import type { Database } from '$lib/server/database/types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		return { jobs: [] };
	}

	const { data: jobs, error } = await supabase
		.from('jobs')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.returns<Database['public']['Tables']['jobs']['Row'][]>();

	if (error) {
		console.error('Error fetching jobs:', error);
		return { jobs: [] };
	}

	return { jobs: jobs || [] };
};
