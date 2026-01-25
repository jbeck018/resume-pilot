<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Button } from '$components/ui/button';
	import {
		Users,
		Briefcase,
		FileText,
		Activity,
		Database,
		Clock,
		TrendingUp,
		BarChart3,
		RefreshCw,
		CheckCircle,
		AlertCircle,
		Server
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// Job sources with their display colors
	const sourceColors: Record<string, string> = {
		adzuna: '#2563eb',
		muse: '#7c3aed',
		greenhouse: '#059669',
		lever: '#ea580c',
		remoteok: '#dc2626',
		weworkremotely: '#0891b2',
		jooble: '#ca8a04'
	};

	// Application status colors
	const statusColors: Record<string, string> = {
		generating: '#f59e0b',
		ready: '#22c55e',
		sent: '#3b82f6',
		error: '#ef4444'
	};

	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + 'M';
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'K';
		}
		return num.toString();
	}

	function getMaxSourceCount(): number {
		const counts = Object.values(data.jobStats.bySource) as number[];
		return Math.max(...counts, 1);
	}
</script>

<svelte:head>
	<title>Admin Dashboard - Resume Pilot</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Admin Dashboard</h1>
			<p class="text-muted-foreground">Application statistics and system health</p>
		</div>
		<Button onclick={() => window.location.reload()}>
			<RefreshCw class="mr-2 h-4 w-4" />
			Refresh
		</Button>
	</div>

	<!-- User Stats -->
	<div>
		<h2 class="mb-4 flex items-center gap-2 text-xl font-semibold">
			<Users class="h-5 w-5" />
			User Statistics
		</h2>
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Users</CardTitle>
					<Users class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{formatNumber(data.userStats.total)}</div>
					<p class="text-xs text-muted-foreground">Registered accounts</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">New Users (7d)</CardTitle>
					<TrendingUp class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{data.userStats.newLast7Days}</div>
					<p class="text-xs text-muted-foreground">Last 7 days</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">New Users (30d)</CardTitle>
					<TrendingUp class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{data.userStats.newLast30Days}</div>
					<p class="text-xs text-muted-foreground">Last 30 days</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Active Users</CardTitle>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{data.userStats.activeLast7Days}</div>
					<p class="text-xs text-muted-foreground">Active in last 7 days</p>
				</CardContent>
			</Card>
		</div>
	</div>

	<!-- Job Stats -->
	<div class="grid gap-6 lg:grid-cols-2">
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Briefcase class="h-5 w-5" />
					Job Statistics
				</CardTitle>
				<CardDescription>Overview of discovered jobs</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="mb-6 grid grid-cols-3 gap-4">
					<div class="text-center">
						<div class="text-2xl font-bold">{formatNumber(data.jobStats.total)}</div>
						<p class="text-xs text-muted-foreground">Total Jobs</p>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold">{data.jobStats.today}</div>
						<p class="text-xs text-muted-foreground">Today</p>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold">{data.jobStats.thisWeek}</div>
						<p class="text-xs text-muted-foreground">This Week</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<BarChart3 class="h-5 w-5" />
					Jobs by Source
				</CardTitle>
				<CardDescription>Distribution across job boards</CardDescription>
			</CardHeader>
			<CardContent>
				{#if Object.keys(data.jobStats.bySource).length > 0}
					<div class="space-y-3">
						{#each (Object.entries(data.jobStats.bySource) as [string, number][]).sort((a, b) => b[1] - a[1]) as [source, count]}
							{@const percentage = (count / getMaxSourceCount()) * 100}
							{@const color = sourceColors[source.toLowerCase()] || '#6b7280'}
							<div class="space-y-1">
								<div class="flex items-center justify-between text-sm">
									<span class="font-medium capitalize">{source}</span>
									<span class="text-muted-foreground">{formatNumber(count)}</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
									<div
										class="h-full rounded-full transition-all duration-500"
										style="width: {percentage}%; background-color: {color}"
									></div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="py-4 text-center text-muted-foreground">No jobs discovered yet</p>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Resume Stats -->
	<div class="grid gap-6 lg:grid-cols-2">
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<FileText class="h-5 w-5" />
					Resume Statistics
				</CardTitle>
				<CardDescription>Resume uploads and generations</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class="rounded-lg border p-4 text-center">
						<div class="text-2xl font-bold">{formatNumber(data.resumeStats.totalResumes)}</div>
						<p class="text-sm text-muted-foreground">Base Resumes</p>
					</div>
					<div class="rounded-lg border p-4 text-center">
						<div class="text-2xl font-bold">{formatNumber(data.resumeStats.totalApplications)}</div>
						<p class="text-sm text-muted-foreground">Generated Applications</p>
					</div>
				</div>

				{#if Object.keys(data.resumeStats.byStatus).length > 0}
					<div class="space-y-2">
						<p class="text-sm font-medium">Applications by Status</p>
						<div class="flex flex-wrap gap-2">
							{#each Object.entries(data.resumeStats.byStatus) as [status, count]}
								{@const color = statusColors[status] || '#6b7280'}
								<Badge
									variant="outline"
									class="gap-1"
									style="border-color: {color}; color: {color}"
								>
									<span class="capitalize">{status}</span>
									<span class="font-bold">{count}</span>
								</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<TrendingUp class="h-5 w-5" />
					Subscription Statistics
				</CardTitle>
				<CardDescription>User subscription tiers</CardDescription>
			</CardHeader>
			<CardContent>
				{#if Object.keys(data.subscriptionStats.byTier).length > 0}
					<div class="space-y-4">
						{#each Object.entries(data.subscriptionStats.byTier) as [tier, stats]}
							<div class="flex items-center justify-between rounded-lg border p-3">
								<div>
									<p class="font-medium capitalize">{tier}</p>
									<p class="text-sm text-muted-foreground">
										{stats.active} active / {stats.total} total
									</p>
								</div>
								<Badge variant={stats.active > 0 ? 'default' : 'secondary'}>
									{stats.total}
								</Badge>
							</div>
						{/each}
					</div>
				{:else}
					<p class="py-4 text-center text-muted-foreground">No subscription data</p>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- System Stats -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Server class="h-5 w-5" />
				System Health
			</CardTitle>
			<CardDescription>Application status and uptime</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-3">
				<div class="flex items-center gap-4 rounded-lg border p-4">
					<Clock class="h-8 w-8 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">Uptime</p>
						<p class="text-lg font-bold">{data.systemStats.uptime.formatted}</p>
					</div>
				</div>

				<div class="flex items-center gap-4 rounded-lg border p-4">
					<Database class="h-8 w-8 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">Database</p>
						<div class="flex items-center gap-2">
							{#if data.systemStats.databaseStatus === 'connected'}
								<CheckCircle class="h-4 w-4 text-green-500" />
								<span class="font-medium text-green-600">Connected</span>
							{:else}
								<AlertCircle class="h-4 w-4 text-red-500" />
								<span class="font-medium text-red-600">Error</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-4 rounded-lg border p-4">
					<Activity class="h-8 w-8 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">Last Checked</p>
						<p class="text-sm text-muted-foreground">
							{new Date(data.systemStats.lastChecked).toLocaleTimeString()}
						</p>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
