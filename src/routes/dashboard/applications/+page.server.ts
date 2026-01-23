import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import type { Database } from '$lib/server/database/types';

export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
	if (!user) {
		return {
			applications: [],
			stats: null,
			filters: {
				status: 'all',
				sortBy: 'date'
			}
		};
	}

	const statusFilter = url.searchParams.get('status') || 'all';
	const sortBy = url.searchParams.get('sort') || 'date';
	const view = url.searchParams.get('view') || 'list'; // list or kanban

	// Build query
	let query = supabase
		.from('jobs')
		.select(
			`
			*,
			applications:job_applications(
				id,
				status,
				created_at,
				updated_at
			)
		`
		)
		.eq('user_id', user.id);

	// Apply status filter
	if (statusFilter !== 'all') {
		query = query.eq('status', statusFilter);
	}

	// Apply sorting
	switch (sortBy) {
		case 'match':
			query = query.order('match_score', { ascending: false, nullsFirst: false });
			break;
		case 'company':
			query = query.order('company', { ascending: true });
			break;
		case 'date':
		default:
			query = query.order('created_at', { ascending: false });
			break;
	}

	const { data: applications, error } = await query;

	if (error) {
		console.error('Error fetching applications:', error);
		return {
			applications: [],
			stats: null,
			filters: {
				status: statusFilter,
				sortBy,
				view
			}
		};
	}

	// Calculate stats
	type JobRow = Database['public']['Tables']['jobs']['Row'];
	type JobWithStatus = JobRow & { status: string };
	const typedApplications = (applications || []) as JobWithStatus[];
	const stats = {
		total: typedApplications.length,
		saved: typedApplications.filter((app) => app.status === 'saved').length,
		applied: typedApplications.filter((app) => app.status === 'applied').length,
		interviewing: typedApplications.filter((app) => app.status === 'interview').length,
		offer: typedApplications.filter((app) => app.status === 'offer').length,
		rejected: typedApplications.filter((app) => app.status === 'rejected').length,
		pending: typedApplications.filter((app) => app.status === 'pending').length
	};

	return {
		applications: applications || [],
		stats,
		filters: {
			status: statusFilter,
			sortBy,
			view
		}
	};
};

export const actions: Actions = {
	updateStatus: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;
		const status = formData.get('status') as string;
		const notes = formData.get('notes') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const updateData: JobUpdate = { status };

		// Add timestamp fields based on status
		if (status === 'applied' && !formData.get('skipTimestamp')) {
			updateData.applied_at = new Date().toISOString();
		}

		const { error } = await supabase
			.from('jobs')
			.update(updateData as Database['public']['Tables']['jobs']['Update'])
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		// If there are notes, we could store them in a separate notes table
		// For now, we'll just return success

		return { success: true };
	},

	deleteApplication: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		const { error } = await supabase.from('jobs').delete().eq('id', jobId).eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	}
};
