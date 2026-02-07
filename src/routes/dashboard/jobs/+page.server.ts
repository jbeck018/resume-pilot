import type { PageServerLoad } from './$types';
import type { Database } from '$lib/server/database/types';

export const load: PageServerLoad = async ({ locals: { supabase, user }, url }) => {
	if (!user) {
		return { jobs: [], showLowMatches: false };
	}

	try {
		// Check if user wants to see low-match jobs
		const showLowMatches = url.searchParams.get('showLowMatches') === 'true';

		// Build the query
		let query = supabase
			.from('jobs')
			.select('*')
			.eq('user_id', user.id);

		// Filter out jobs with match_score < 15 by default
		if (!showLowMatches) {
			query = query.or('match_score.gte.15,match_score.is.null');
		}

		const { data: jobs, error } = await query
			.order('created_at', { ascending: false })
			.returns<Database['public']['Tables']['jobs']['Row'][]>();

		if (error) {
			console.error('Error fetching jobs:', error);
			return { jobs: [], showLowMatches };
		}

		return { jobs: jobs || [], showLowMatches };
	} catch (error) {
		console.error('Error in jobs page load:', error);
		return { jobs: [], showLowMatches: false };
	}
};
