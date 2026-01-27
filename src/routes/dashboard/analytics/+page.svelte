<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import {
		BarChart3,
		Target,
		TrendingUp,
		Users,
		AlertTriangle,
		CheckCircle,
		XCircle,
		Clock
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// Derived values for charts
	let maxFunnelValue = $derived(
		Math.max(
			data.funnelStats.saved,
			data.funnelStats.applied,
			data.funnelStats.interview,
			data.funnelStats.offer,
			data.funnelStats.rejected,
			1
		)
	);

	let maxScoreCount = $derived(
		Math.max(...data.matchScoreDistribution.map((d) => d.count), 1)
	);

	let maxSkillCount = $derived(
		Math.max(...data.skillsGaps.map((s) => s.totalCount), 1)
	);

	let maxActivityValue = $derived(
		Math.max(
			...data.activityTrends.flatMap((t) => [t.discovered, t.applied, t.resumes]),
			1
		)
	);

	// Funnel stages configuration
	const funnelStages = [
		{ key: 'saved', label: 'Saved', color: '#6366f1', icon: Clock },
		{ key: 'applied', label: 'Applied', color: '#3b82f6', icon: CheckCircle },
		{ key: 'interview', label: 'Interview', color: '#8b5cf6', icon: Users },
		{ key: 'offer', label: 'Offer', color: '#22c55e', icon: TrendingUp },
		{ key: 'rejected', label: 'Rejected', color: '#ef4444', icon: XCircle }
	] as const;

	// Color palette for charts
	const chartColors = {
		primary: 'hsl(var(--primary))',
		secondary: 'hsl(var(--secondary))',
		muted: 'hsl(var(--muted))',
		accent: 'hsl(var(--accent))'
	};
</script>

<svelte:head>
	<title>Analytics - HowlerHire</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold">Analytics</h1>
		<p class="text-muted-foreground">Track your job search progress and identify areas for improvement</p>
	</div>

	<!-- Summary Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Total Jobs Tracked</CardTitle>
				<BarChart3 class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.totals.jobs}</div>
				<p class="text-xs text-muted-foreground">Across all stages</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Applications Sent</CardTitle>
				<CheckCircle class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.totals.applications}</div>
				<p class="text-xs text-muted-foreground">Active applications</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Avg Match Score</CardTitle>
				<Target class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.totals.avgMatchScore}%</div>
				<p class="text-xs text-muted-foreground">Job compatibility</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Success Rate</CardTitle>
				<TrendingUp class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.totals.successRate}%</div>
				<p class="text-xs text-muted-foreground">Interview + Offer rate</p>
			</CardContent>
		</Card>
	</div>

	<!-- Main Charts Row -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Application Funnel -->
		<Card>
			<CardHeader>
				<CardTitle>Application Funnel</CardTitle>
				<CardDescription>Your job search pipeline by stage</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					{#each funnelStages as stage}
						{@const value = data.funnelStats[stage.key]}
						{@const percentage = maxFunnelValue > 0 ? (value / maxFunnelValue) * 100 : 0}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<stage.icon class="h-4 w-4" style="color: {stage.color}" />
									<span class="text-sm font-medium">{stage.label}</span>
								</div>
								<span class="text-sm font-bold">{value}</span>
							</div>
							<div class="h-3 w-full overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full transition-all duration-500"
									style="width: {percentage}%; background-color: {stage.color}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>

		<!-- Match Score Distribution -->
		<Card>
			<CardHeader>
				<CardTitle>Match Score Distribution</CardTitle>
				<CardDescription>How well jobs match your profile</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex h-64 items-end justify-between gap-2">
					{#each data.matchScoreDistribution as bucket, i}
						{@const height = maxScoreCount > 0 ? (bucket.count / maxScoreCount) * 100 : 0}
						{@const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']}
						<div class="flex flex-1 flex-col items-center gap-2">
							<span class="text-xs font-medium">{bucket.count}</span>
							<div class="relative w-full flex-1">
								<div
									class="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
									style="height: {height}%; background-color: {colors[i]}; min-height: {bucket.count > 0 ? '8px' : '0'}"
								></div>
							</div>
							<span class="text-xs text-muted-foreground">{bucket.range}</span>
						</div>
					{/each}
				</div>
				{#if data.matchScoreDistribution.every(b => b.count === 0)}
					<div class="flex h-64 items-center justify-center text-muted-foreground">
						<p>No match score data available yet</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Activity Timeline -->
	<Card>
		<CardHeader>
			<CardTitle>Activity Timeline</CardTitle>
			<CardDescription>Weekly job search activity over the past 8 weeks</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.activityTrends.length > 0}
				<div class="space-y-4">
					<!-- Legend -->
					<div class="flex flex-wrap gap-4 text-sm">
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-blue-500"></div>
							<span>Jobs Discovered</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-green-500"></div>
							<span>Applications</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-purple-500"></div>
							<span>Resumes Generated</span>
						</div>
					</div>

					<!-- Chart -->
					<div class="relative h-64">
						<svg class="h-full w-full" viewBox="0 0 800 240" preserveAspectRatio="none">
							<!-- Grid lines -->
							{#each [0, 1, 2, 3, 4] as i}
								<line
									x1="50"
									y1={40 + i * 40}
									x2="780"
									y2={40 + i * 40}
									stroke="currentColor"
									stroke-opacity="0.1"
									stroke-width="1"
								/>
							{/each}

							<!-- Y-axis labels -->
							{#each [0, 1, 2, 3, 4] as i}
								{@const value = Math.round(maxActivityValue * (1 - i / 4))}
								<text
									x="40"
									y={45 + i * 40}
									text-anchor="end"
									class="fill-muted-foreground text-xs"
									font-size="10"
								>
									{value}
								</text>
							{/each}

							<!-- Bars for each week -->
							{#each data.activityTrends as trend, i}
								{@const barWidth = 20}
								{@const groupWidth = 90}
								{@const startX = 70 + i * groupWidth}
								{@const chartHeight = 160}

								<!-- Discovered bars (blue) -->
								{@const discoveredHeight = maxActivityValue > 0 ? (trend.discovered / maxActivityValue) * chartHeight : 0}
								<rect
									x={startX}
									y={200 - discoveredHeight}
									width={barWidth}
									height={discoveredHeight}
									fill="#3b82f6"
									rx="2"
								/>

								<!-- Applied bars (green) -->
								{@const appliedHeight = maxActivityValue > 0 ? (trend.applied / maxActivityValue) * chartHeight : 0}
								<rect
									x={startX + barWidth + 4}
									y={200 - appliedHeight}
									width={barWidth}
									height={appliedHeight}
									fill="#22c55e"
									rx="2"
								/>

								<!-- Resumes bars (purple) -->
								{@const resumesHeight = maxActivityValue > 0 ? (trend.resumes / maxActivityValue) * chartHeight : 0}
								<rect
									x={startX + (barWidth + 4) * 2}
									y={200 - resumesHeight}
									width={barWidth}
									height={resumesHeight}
									fill="#8b5cf6"
									rx="2"
								/>

								<!-- Week label -->
								<text
									x={startX + barWidth + 12}
									y="225"
									text-anchor="middle"
									class="fill-muted-foreground"
									font-size="10"
								>
									{trend.week}
								</text>
							{/each}
						</svg>
					</div>
				</div>
			{:else}
				<div class="flex h-64 items-center justify-center text-muted-foreground">
					<p>No activity data available yet</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Bottom Row: Skills Gaps and Company Stats -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Skills Gap Analysis -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-amber-500" />
					Skills Gap Analysis
				</CardTitle>
				<CardDescription>Most frequently missing skills across job applications</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.skillsGaps.length > 0}
					<div class="space-y-3">
						{#each data.skillsGaps as skill}
							{@const requiredPercent = maxSkillCount > 0 ? (skill.requiredCount / maxSkillCount) * 100 : 0}
							{@const preferredPercent = maxSkillCount > 0 ? (skill.preferredCount / maxSkillCount) * 100 : 0}
							<div class="space-y-1">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium">{skill.skill}</span>
									<div class="flex items-center gap-2">
										{#if skill.requiredCount > 0}
											<Badge variant="destructive" class="text-xs">
												{skill.requiredCount} required
											</Badge>
										{/if}
										{#if skill.preferredCount > 0}
											<Badge variant="secondary" class="text-xs">
												{skill.preferredCount} preferred
											</Badge>
										{/if}
									</div>
								</div>
								<div class="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
									<div
										class="h-full bg-red-500 transition-all duration-500"
										style="width: {requiredPercent}%"
									></div>
									<div
										class="h-full bg-amber-500 transition-all duration-500"
										style="width: {preferredPercent}%"
									></div>
								</div>
							</div>
						{/each}
					</div>

					<div class="mt-4 flex gap-4 text-xs text-muted-foreground">
						<div class="flex items-center gap-1">
							<div class="h-2 w-2 rounded-full bg-red-500"></div>
							<span>Required</span>
						</div>
						<div class="flex items-center gap-1">
							<div class="h-2 w-2 rounded-full bg-amber-500"></div>
							<span>Preferred</span>
						</div>
					</div>
				{:else}
					<div class="flex h-48 items-center justify-center text-muted-foreground">
						<div class="text-center">
							<AlertTriangle class="mx-auto h-8 w-8 opacity-50" />
							<p class="mt-2">No skills gap data available</p>
							<p class="text-xs">Apply to more jobs to see analysis</p>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Success Rate by Company -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Users class="h-5 w-5 text-blue-500" />
					Performance by Company
				</CardTitle>
				<CardDescription>Your application success rate by company</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.companyStats.length > 0}
					<div class="space-y-4">
						{#each data.companyStats as company}
							<div class="flex items-center justify-between rounded-lg border p-3">
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{company.company}</p>
									<div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
										<span>{company.total} application{company.total !== 1 ? 's' : ''}</span>
										{#if company.interviews > 0}
											<span class="text-purple-500">{company.interviews} interview{company.interviews !== 1 ? 's' : ''}</span>
										{/if}
										{#if company.offers > 0}
											<span class="text-green-500">{company.offers} offer{company.offers !== 1 ? 's' : ''}</span>
										{/if}
									</div>
								</div>
								<div class="ml-4 flex flex-col items-end gap-1">
									<Badge variant={company.successRate >= 50 ? 'default' : company.successRate > 0 ? 'secondary' : 'outline'}>
										{company.successRate}% success
									</Badge>
									{#if company.avgMatchScore !== null}
										<span class="text-xs text-muted-foreground">{company.avgMatchScore}% match</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex h-48 items-center justify-center text-muted-foreground">
						<div class="text-center">
							<Users class="mx-auto h-8 w-8 opacity-50" />
							<p class="mt-2">No company data available</p>
							<p class="text-xs">Apply to jobs to see company insights</p>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Insights Section -->
	{#if data.totals.jobs > 0}
		<Card>
			<CardHeader>
				<CardTitle>Insights</CardTitle>
				<CardDescription>Key observations from your job search data</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#if data.totals.avgMatchScore < 60}
						<div class="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
							<AlertTriangle class="h-5 w-5 text-amber-500 shrink-0" />
							<div>
								<p class="font-medium text-amber-500">Low Match Scores</p>
								<p class="mt-1 text-sm text-muted-foreground">
									Your average match score is {data.totals.avgMatchScore}%. Consider updating your profile or targeting different roles.
								</p>
							</div>
						</div>
					{/if}

					{#if data.skillsGaps.length > 0}
						<div class="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
							<Target class="h-5 w-5 text-blue-500 shrink-0" />
							<div>
								<p class="font-medium text-blue-500">Top Skill to Learn</p>
								<p class="mt-1 text-sm text-muted-foreground">
									"{data.skillsGaps[0].skill}" appears most frequently in jobs you're missing. Consider upskilling.
								</p>
							</div>
						</div>
					{/if}

					{#if data.funnelStats.applied > 0 && data.funnelStats.interview === 0}
						<div class="flex items-start gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
							<TrendingUp class="h-5 w-5 text-purple-500 shrink-0" />
							<div>
								<p class="font-medium text-purple-500">Resume Optimization</p>
								<p class="mt-1 text-sm text-muted-foreground">
									You've applied to {data.funnelStats.applied} jobs but no interviews yet. Try tailoring your resume more.
								</p>
							</div>
						</div>
					{/if}

					{#if data.totals.successRate >= 30}
						<div class="flex items-start gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
							<CheckCircle class="h-5 w-5 text-green-500 shrink-0" />
							<div>
								<p class="font-medium text-green-500">Strong Performance</p>
								<p class="mt-1 text-sm text-muted-foreground">
									Your {data.totals.successRate}% success rate is above average. Keep up the good work!
								</p>
							</div>
						</div>
					{/if}

					{#if data.funnelStats.saved > data.funnelStats.applied * 3}
						<div class="flex items-start gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
							<Clock class="h-5 w-5 text-orange-500 shrink-0" />
							<div>
								<p class="font-medium text-orange-500">Many Saved Jobs</p>
								<p class="mt-1 text-sm text-muted-foreground">
									You have {data.funnelStats.saved} saved jobs. Consider applying to more of them!
								</p>
							</div>
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
