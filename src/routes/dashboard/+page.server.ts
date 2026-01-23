import type { PageServerLoad } from './$types';
import type { Database } from '$lib/server/database/types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		return {
			stats: null,
			recentJobs: [],
			profileCompletion: 0,
			resumeCount: 0,
			generatedCount: 0,
			usage: null
		};
	}

	// Get current week start for usage tracking
	const today = new Date();
	const dayOfWeek = today.getDay();
	const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday
	const weekStart = new Date(today);
	weekStart.setDate(today.getDate() + diff);
	weekStart.setHours(0, 0, 0, 0);

	// Get job statistics
	const [
		pendingJobs,
		appliedJobs,
		interviewJobs,
		offerJobs,
		recentJobs,
		profile,
		resumes,
		applications,
		usage
	] = await Promise.all([
		supabase
			.from('jobs')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'pending'),

		supabase
			.from('jobs')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'applied'),

		supabase
			.from('jobs')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'interview'),

		supabase
			.from('jobs')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'offer'),

		supabase
			.from('jobs')
			.select('id, title, company, location, match_score, status, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(5),

		supabase.from('profiles').select('*').eq('user_id', user.id).single(),

		supabase.from('resumes').select('id', { count: 'exact' }).eq('user_id', user.id),

		supabase.from('job_applications').select('id', { count: 'exact' }).eq('user_id', user.id),

		supabase
			.from('usage_tracking')
			.select('*')
			.eq('user_id', user.id)
			.eq('week_start_date', weekStart.toISOString().split('T')[0])
			.single()
	]);

	// Calculate profile completion
	let profileCompletion = 0;
	type ProfileRow = Database['public']['Tables']['profiles']['Row'];
	const profileData = profile.data as ProfileRow | null;
	if (profileData) {
		const fields: (keyof ProfileRow)[] = [
			'full_name',
			'headline',
			'summary',
			'location',
			'linkedin_url',
			'skills',
			'experience',
			'preferred_roles'
		];
		const filledFields = fields.filter((field) => {
			const value = profileData[field];
			if (Array.isArray(value)) return value.length > 0;
			return !!value;
		});
		profileCompletion = Math.round((filledFields.length / fields.length) * 100);
	}

	// Calculate today's new jobs
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	const { count: newJobsToday } = await supabase
		.from('jobs')
		.select('id', { count: 'exact' })
		.eq('user_id', user.id)
		.gte('created_at', todayStart.toISOString());

	// Calculate match rate from feedback
	const { data: feedbackData } = await supabase
		.from('jobs')
		.select('user_feedback')
		.eq('user_id', user.id)
		.not('user_feedback', 'is', null)
		.returns<{ user_feedback: string | null }[]>();

	let matchRate = 0;
	if (feedbackData && feedbackData.length > 0) {
		const goodMatches = feedbackData.filter(
			(j: { user_feedback: string | null }) => j.user_feedback === 'good_match'
		).length;
		matchRate = Math.round((goodMatches / feedbackData.length) * 100);
	}

	return {
		stats: {
			newJobs: newJobsToday || 0,
			applied: appliedJobs.count || 0,
			pending: pendingJobs.count || 0,
			interviews: interviewJobs.count || 0,
			offers: offerJobs.count || 0,
			matchRate
		},
		recentJobs: recentJobs.data || [],
		profileCompletion,
		resumeCount: resumes.count || 0,
		generatedCount: applications.count || 0,
		usage: usage.data || null
	};
};
