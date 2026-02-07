import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;

	try {
		// Fetch the application
		const { data: application, error } = await supabase
			.from('job_applications')
			.select('*')
			.eq('id', id)
			.eq('user_id', user.id)
			.single();

		if (error || !application) {
			return json({ error: 'Application not found' }, { status: 404 });
		}

		// Return the application data - map 'failed' status to 'error' for frontend compatibility
		const status = application.status === 'failed' ? 'error' : application.status;

		return json({
			id: application.id,
			status,
			tailored_resume: application.tailored_resume,
			cover_letter: application.cover_letter,
			error_message: application.error_message,
			match_score: application.match_score,
			ats_score: application.ats_score,
			quality_score: application.quality_score,
			matched_skills: application.matched_skills,
			skill_gaps: application.skill_gaps
		});
	} catch (error) {
		console.error('[Applications API] Error fetching application:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
