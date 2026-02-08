import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// App start time for uptime calculation
const APP_START_TIME = Date.now();

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Note: Authentication and admin checks are handled by +layout.server.ts

	// Calculate date ranges
	const now = new Date();
	const todayStart = new Date(now);
	todayStart.setHours(0, 0, 0, 0);

	const sevenDaysAgo = new Date(now);
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	const thirtyDaysAgo = new Date(now);
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const weekStart = new Date(now);
	const dayOfWeek = weekStart.getDay();
	const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	weekStart.setDate(weekStart.getDate() + diff);
	weekStart.setHours(0, 0, 0, 0);

	let results;
	try {
		// Run all queries in parallel
		results = await Promise.all([
			// User stats
			supabase.from('profiles').select('id', { count: 'exact', head: true }),

			// New users last 7 days
			supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.gte('created_at', sevenDaysAgo.toISOString()),

			// New users last 30 days
			supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.gte('created_at', thirtyDaysAgo.toISOString()),

			// Active users (logged in last 7 days - approximate via updated_at)
			supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.gte('updated_at', sevenDaysAgo.toISOString()),

			// Total jobs
			supabase.from('jobs').select('id', { count: 'exact', head: true }),

			// Jobs by source
			supabase.from('jobs').select('source'),

			// Jobs discovered today
			supabase
				.from('jobs')
				.select('id', { count: 'exact', head: true })
				.gte('discovered_at', todayStart.toISOString()),

			// Jobs discovered this week
			supabase
				.from('jobs')
				.select('id', { count: 'exact', head: true })
				.gte('discovered_at', weekStart.toISOString()),

			// Total resumes
			supabase.from('resumes').select('id', { count: 'exact', head: true }),

			// Applications by status
			supabase.from('job_applications').select('status'),

			// Subscriptions by tier
			supabase.from('user_subscriptions').select('tier_id, status, subscription_tiers(name)'),

			// Database health check
			supabase.from('profiles').select('id').limit(1)
		]);
	} catch (err) {
		console.error('[Admin Dashboard] Failed to load dashboard stats:', err);
		error(500, 'Failed to load dashboard statistics. Please try again later.');
	}

	const [
		// User stats
		totalUsersResult,
		newUsers7dResult,
		newUsers30dResult,
		activeUsersResult,

		// Job stats
		totalJobsResult,
		jobsBySourceResult,
		jobsTodayResult,
		jobsThisWeekResult,

		// Resume stats
		totalResumesResult,
		applicationsByStatusResult,

		// Subscription stats
		subscriptionsByTierResult,

		// Database connection check
		dbCheckResult
	] = results;

	// Process jobs by source
	const jobsBySource: Record<string, number> = {};
	const sourceData = (jobsBySourceResult.data || []) as { source: string }[];
	sourceData.forEach((job) => {
		const source = job.source || 'unknown';
		jobsBySource[source] = (jobsBySource[source] || 0) + 1;
	});

	// Process applications by status
	const applicationsByStatus: Record<string, number> = {};
	const appStatusData = (applicationsByStatusResult.data || []) as { status: string }[];
	appStatusData.forEach((app) => {
		const status = app.status || 'unknown';
		applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1;
	});

	// Process subscriptions by tier
	const subscriptionsByTier: Record<string, { total: number; active: number }> = {};
	const subData = (subscriptionsByTierResult.data || []) as {
		tier_id: string;
		status: string;
		subscription_tiers: { name: string } | null;
	}[];
	subData.forEach((sub) => {
		const tierName = sub.subscription_tiers?.name || 'unknown';
		if (!subscriptionsByTier[tierName]) {
			subscriptionsByTier[tierName] = { total: 0, active: 0 };
		}
		subscriptionsByTier[tierName].total++;
		if (sub.status === 'active') {
			subscriptionsByTier[tierName].active++;
		}
	});

	// Calculate uptime
	const uptimeMs = Date.now() - APP_START_TIME;
	const uptimeSeconds = Math.floor(uptimeMs / 1000);
	const uptimeDays = Math.floor(uptimeSeconds / 86400);
	const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
	const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

	return {
		userStats: {
			total: totalUsersResult.count || 0,
			newLast7Days: newUsers7dResult.count || 0,
			newLast30Days: newUsers30dResult.count || 0,
			activeLast7Days: activeUsersResult.count || 0
		},
		jobStats: {
			total: totalJobsResult.count || 0,
			bySource: jobsBySource,
			today: jobsTodayResult.count || 0,
			thisWeek: jobsThisWeekResult.count || 0
		},
		resumeStats: {
			totalResumes: totalResumesResult.count || 0,
			totalApplications: appStatusData.length,
			byStatus: applicationsByStatus
		},
		subscriptionStats: {
			byTier: subscriptionsByTier
		},
		systemStats: {
			uptime: {
				days: uptimeDays,
				hours: uptimeHours,
				minutes: uptimeMinutes,
				formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
			},
			databaseStatus: dbCheckResult.error ? 'error' : 'connected',
			lastChecked: now.toISOString()
		}
	};
};
