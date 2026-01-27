<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import UsageIndicator from '$lib/components/UsageIndicator.svelte';
	import {
		Briefcase,
		CheckCircle,
		Clock,
		FileText,
		RefreshCw,
		TrendingUp,
		XCircle
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard - HowlerHire</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Dashboard</h1>
			<p class="text-muted-foreground">
				Welcome back{data.user?.email ? `, ${data.user.email.split('@')[0]}` : ''}
			</p>
		</div>
		<Button>
			<RefreshCw class="mr-2 h-4 w-4" />
			Find Jobs Now
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">New Jobs</CardTitle>
				<Briefcase class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats?.newJobs || 0}</div>
				<p class="text-xs text-muted-foreground">Discovered today</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Applied</CardTitle>
				<CheckCircle class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats?.applied || 0}</div>
				<p class="text-xs text-muted-foreground">This month</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Interviews</CardTitle>
				<Clock class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats?.interviews || 0}</div>
				<p class="text-xs text-muted-foreground">Active interviews</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Offers</CardTitle>
				<TrendingUp class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats?.offers || 0}</div>
				<p class="text-xs text-muted-foreground">Pending decisions</p>
			</CardContent>
		</Card>
	</div>

	<!-- Recent Jobs -->
	<Card>
		<CardHeader>
			<CardTitle>Recent Jobs</CardTitle>
			<CardDescription>Your latest job matches with generated applications</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.recentJobs && data.recentJobs.length > 0}
				<div class="space-y-4">
					{#each data.recentJobs as job}
						<div
							class="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
						>
							<div class="flex items-center gap-4">
								<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
									<Briefcase class="h-6 w-6 text-primary" />
								</div>
								<div>
									<h3 class="font-semibold">{job.title}</h3>
									<p class="text-sm text-muted-foreground">{job.company}</p>
								</div>
							</div>

							<div class="flex items-center gap-4">
								{#if job.matchScore}
									<Badge variant={job.matchScore >= 70 ? 'default' : 'secondary'}>
										{job.matchScore}% match
									</Badge>
								{/if}

								{#if job.status === 'pending'}
									<Badge variant="outline">
										<Clock class="mr-1 h-3 w-3" />
										Pending
									</Badge>
								{:else if job.status === 'applied'}
									<Badge variant="default">
										<CheckCircle class="mr-1 h-3 w-3" />
										Applied
									</Badge>
								{:else if job.status === 'not_relevant'}
									<Badge variant="secondary">
										<XCircle class="mr-1 h-3 w-3" />
										Not Relevant
									</Badge>
								{/if}

								<Button variant="outline" size="sm" href="/dashboard/jobs/{job.id}">View</Button>
							</div>
						</div>
					{/each}
				</div>

				<div class="mt-4 flex justify-center gap-2">
					<Button variant="outline" href="/dashboard/jobs">View All Jobs</Button>
					<Button variant="default" href="/dashboard/applications">Track Applications</Button>
				</div>
			{:else}
				<div class="py-12 text-center">
					<Briefcase class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 text-lg font-semibold">No jobs yet</h3>
					<p class="mt-2 text-muted-foreground">
						Complete your profile and we'll start finding matching jobs for you.
					</p>
					<Button class="mt-4" href="/dashboard/profile">Complete Profile</Button>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Quick Actions -->
	<div class="grid gap-4 md:grid-cols-3">
		<!-- Usage Indicator -->
		<UsageIndicator usage={data.usage} />

		<Card>
			<CardHeader>
				<CardTitle>Profile Completion</CardTitle>
				<CardDescription>Help us find better matches for you</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span>Profile completion</span>
						<span class="font-semibold">{data.profileCompletion || 0}%</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full bg-primary transition-all"
							style="width: {data.profileCompletion || 0}%"
						></div>
					</div>
					<Button variant="outline" class="w-full" href="/dashboard/profile">
						Update Profile
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Resumes</CardTitle>
				<CardDescription>Manage your base resumes</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<div class="flex items-center gap-4">
						<FileText class="h-8 w-8 text-muted-foreground" />
						<div>
							<p class="font-medium">{data.resumeCount || 0} resume(s) uploaded</p>
							<p class="text-sm text-muted-foreground">
								{data.generatedCount || 0} tailored versions generated
							</p>
						</div>
					</div>
					<Button variant="outline" class="w-full" href="/dashboard/resumes">
						Manage Resumes
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
