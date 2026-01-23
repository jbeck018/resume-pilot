import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		return {
			funnelStats: { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 },
			matchScoreDistribution: [],
			skillsGaps: [],
			activityTrends: [],
			companyStats: [],
			totals: { jobs: 0, applications: 0, avgMatchScore: 0, successRate: 0 }
		};
	}

	// Get application funnel stats (by job status)
	const funnelPromise = Promise.all([
		supabase
			.from('jobs')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'saved'),
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
			.select('id', { count: 'exact' })
			.eq('user_id', user.id)
			.eq('status', 'rejected')
	]);

	// Get match score distribution (0-20, 21-40, 41-60, 61-80, 81-100)
	const matchScorePromise = supabase
		.from('jobs')
		.select('match_score')
		.eq('user_id', user.id)
		.not('match_score', 'is', null);

	// Get skills gaps (missing_required_skills aggregated across all jobs)
	const skillsGapsPromise = supabase
		.from('jobs')
		.select('missing_required_skills, missing_preferred_skills, company')
		.eq('user_id', user.id)
		.not('missing_required_skills', 'is', null);

	// Get weekly activity trends (last 8 weeks)
	const eightWeeksAgo = new Date();
	eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

	const activityPromise = supabase
		.from('jobs')
		.select('discovered_at, status')
		.eq('user_id', user.id)
		.gte('discovered_at', eightWeeksAgo.toISOString())
		.order('discovered_at', { ascending: true });

	const resumeActivityPromise = supabase
		.from('job_applications')
		.select('created_at')
		.eq('user_id', user.id)
		.gte('created_at', eightWeeksAgo.toISOString());

	// Get success rate by company
	const companyStatsPromise = supabase
		.from('jobs')
		.select('company, status, match_score')
		.eq('user_id', user.id)
		.in('status', ['applied', 'interview', 'offer', 'rejected']);

	// Execute all queries in parallel
	const [
		funnelResults,
		matchScoreResult,
		skillsGapsResult,
		activityResult,
		resumeActivityResult,
		companyStatsResult
	] = await Promise.all([
		funnelPromise,
		matchScorePromise,
		skillsGapsPromise,
		activityPromise,
		resumeActivityPromise,
		companyStatsPromise
	]);

	const [saved, applied, interview, offer, rejected] = funnelResults;

	// Process funnel stats
	const funnelStats = {
		saved: saved.count || 0,
		applied: applied.count || 0,
		interview: interview.count || 0,
		offer: offer.count || 0,
		rejected: rejected.count || 0
	};

	// Process match score distribution
	const matchScores = (matchScoreResult.data || []) as { match_score: number | null }[];
	const scoreRanges = [
		{ range: '0-20', min: 0, max: 20, count: 0 },
		{ range: '21-40', min: 21, max: 40, count: 0 },
		{ range: '41-60', min: 41, max: 60, count: 0 },
		{ range: '61-80', min: 61, max: 80, count: 0 },
		{ range: '81-100', min: 81, max: 100, count: 0 }
	];

	matchScores.forEach((job) => {
		const score = job.match_score;
		if (score !== null) {
			const bucket = scoreRanges.find((r) => score >= r.min && score <= r.max);
			if (bucket) bucket.count++;
		}
	});

	const matchScoreDistribution = scoreRanges.map((r) => ({
		range: r.range,
		count: r.count
	}));

	// Process skills gaps
	const skillsGapsData = (skillsGapsResult.data || []) as {
		missing_required_skills: string[] | null;
		missing_preferred_skills: string[] | null;
	}[];

	const skillCounts: Record<string, { required: number; preferred: number }> = {};

	skillsGapsData.forEach((job) => {
		(job.missing_required_skills || []).forEach((skill) => {
			const normalized = skill.toLowerCase().trim();
			if (!skillCounts[normalized]) {
				skillCounts[normalized] = { required: 0, preferred: 0 };
			}
			skillCounts[normalized].required++;
		});
		(job.missing_preferred_skills || []).forEach((skill) => {
			const normalized = skill.toLowerCase().trim();
			if (!skillCounts[normalized]) {
				skillCounts[normalized] = { required: 0, preferred: 0 };
			}
			skillCounts[normalized].preferred++;
		});
	});

	const skillsGaps = Object.entries(skillCounts)
		.map(([skill, counts]) => ({
			skill: skill.charAt(0).toUpperCase() + skill.slice(1),
			requiredCount: counts.required,
			preferredCount: counts.preferred,
			totalCount: counts.required + counts.preferred
		}))
		.sort((a, b) => b.totalCount - a.totalCount)
		.slice(0, 10);

	// Process weekly activity trends
	const activityData = (activityResult.data || []) as { discovered_at: string; status: string }[];
	const resumeData = (resumeActivityResult.data || []) as { created_at: string }[];

	const weeklyActivity: Record<string, { discovered: number; applied: number; resumes: number }> =
		{};

	// Initialize 8 weeks
	for (let i = 0; i < 8; i++) {
		const date = new Date();
		date.setDate(date.getDate() - i * 7);
		const weekStart = getWeekStart(date);
		const weekKey = weekStart.toISOString().split('T')[0];
		weeklyActivity[weekKey] = { discovered: 0, applied: 0, resumes: 0 };
	}

	activityData.forEach((job) => {
		const weekStart = getWeekStart(new Date(job.discovered_at));
		const weekKey = weekStart.toISOString().split('T')[0];
		if (weeklyActivity[weekKey]) {
			weeklyActivity[weekKey].discovered++;
			if (job.status === 'applied' || job.status === 'interview' || job.status === 'offer') {
				weeklyActivity[weekKey].applied++;
			}
		}
	});

	resumeData.forEach((app) => {
		const weekStart = getWeekStart(new Date(app.created_at));
		const weekKey = weekStart.toISOString().split('T')[0];
		if (weeklyActivity[weekKey]) {
			weeklyActivity[weekKey].resumes++;
		}
	});

	const activityTrends = Object.entries(weeklyActivity)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([week, data]) => ({
			week: formatWeekLabel(week),
			...data
		}));

	// Process company stats
	const companyData = (companyStatsResult.data || []) as {
		company: string;
		status: string;
		match_score: number | null;
	}[];

	const companyMap: Record<
		string,
		{
			applied: number;
			interview: number;
			offer: number;
			rejected: number;
			matchScores: number[];
		}
	> = {};

	companyData.forEach((job) => {
		if (!companyMap[job.company]) {
			companyMap[job.company] = {
				applied: 0,
				interview: 0,
				offer: 0,
				rejected: 0,
				matchScores: []
			};
		}
		const company = companyMap[job.company];
		if (job.status === 'applied') company.applied++;
		if (job.status === 'interview') company.interview++;
		if (job.status === 'offer') company.offer++;
		if (job.status === 'rejected') company.rejected++;
		if (job.match_score !== null) company.matchScores.push(job.match_score);
	});

	const companyStats = Object.entries(companyMap)
		.map(([company, stats]) => {
			const total = stats.applied + stats.interview + stats.offer + stats.rejected;
			const positive = stats.interview + stats.offer;
			const avgScore =
				stats.matchScores.length > 0
					? Math.round(stats.matchScores.reduce((a, b) => a + b, 0) / stats.matchScores.length)
					: null;
			return {
				company,
				total,
				successRate: total > 0 ? Math.round((positive / total) * 100) : 0,
				avgMatchScore: avgScore,
				interviews: stats.interview,
				offers: stats.offer
			};
		})
		.filter((c) => c.total >= 1)
		.sort((a, b) => b.total - a.total)
		.slice(0, 10);

	// Calculate totals
	const totalJobs =
		funnelStats.saved +
		funnelStats.applied +
		funnelStats.interview +
		funnelStats.offer +
		funnelStats.rejected;
	const totalApplications = funnelStats.applied + funnelStats.interview + funnelStats.offer;
	const avgMatchScore =
		matchScores.length > 0
			? Math.round(
					matchScores.reduce((sum, j) => sum + (j.match_score || 0), 0) / matchScores.length
				)
			: 0;
	const overallSuccessRate =
		totalApplications > 0
			? Math.round(((funnelStats.interview + funnelStats.offer) / totalApplications) * 100)
			: 0;

	return {
		funnelStats,
		matchScoreDistribution,
		skillsGaps,
		activityTrends,
		companyStats,
		totals: {
			jobs: totalJobs,
			applications: totalApplications,
			avgMatchScore,
			successRate: overallSuccessRate
		}
	};
};

function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function formatWeekLabel(isoDate: string): string {
	const date = new Date(isoDate);
	const month = date.toLocaleDateString('en-US', { month: 'short' });
	const day = date.getDate();
	return `${month} ${day}`;
}
