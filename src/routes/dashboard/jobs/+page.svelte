<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import {
		Briefcase,
		CheckCircle,
		Clock,
		ExternalLink,
		Filter,
		MapPin,
		Search,
		XCircle
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';

	type JobData = {
		id: string;
		title: string;
		company: string;
		status: string;
		location?: string;
		match_score?: number;
		created_at?: string;
		source_url?: string;
		[key: string]: unknown;
	};

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	const filteredJobs = $derived(() => {
		let jobs = (data.jobs || []) as JobData[];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			jobs = jobs.filter(
				(job) =>
					job.title.toLowerCase().includes(query) ||
					job.company.toLowerCase().includes(query)
			);
		}

		if (statusFilter !== 'all') {
			jobs = jobs.filter((job) => job.status === statusFilter);
		}

		return jobs;
	});

	const statusOptions = [
		{ value: 'all', label: 'All Jobs' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'reviewing', label: 'Reviewing' },
		{ value: 'applied', label: 'Applied' },
		{ value: 'interview', label: 'Interview' },
		{ value: 'not_relevant', label: 'Not Relevant' }
	];

	function getStatusBadge(status: string) {
		switch (status) {
			case 'pending':
				return { variant: 'outline' as const, icon: Clock, label: 'Pending' };
			case 'reviewing':
				return { variant: 'secondary' as const, icon: Clock, label: 'Reviewing' };
			case 'applied':
				return { variant: 'default' as const, icon: CheckCircle, label: 'Applied' };
			case 'interview':
				return { variant: 'default' as const, icon: CheckCircle, label: 'Interview' };
			case 'not_relevant':
				return { variant: 'secondary' as const, icon: XCircle, label: 'Not Relevant' };
			default:
				return { variant: 'outline' as const, icon: Clock, label: status };
		}
	}
</script>

<svelte:head>
	<title>Jobs - Resume Pilot</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Jobs</h1>
			<p class="text-muted-foreground">Manage your job matches and applications</p>
		</div>
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="pt-6">
			<div class="flex flex-col gap-4 md:flex-row">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search jobs..."
						class="pl-10"
						bind:value={searchQuery}
					/>
				</div>

				<div class="flex gap-2">
					{#each statusOptions as option}
						<Button
							variant={statusFilter === option.value ? 'default' : 'outline'}
							size="sm"
							onclick={() => (statusFilter = option.value)}
						>
							{option.label}
						</Button>
					{/each}
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Jobs List -->
	{#if filteredJobs().length > 0}
		<div class="space-y-4">
			{#each filteredJobs() as job}
				{@const statusInfo = getStatusBadge(job.status)}
				<Card class="transition-colors hover:border-primary/50">
					<CardContent class="pt-6">
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-start gap-4">
								<div
									class="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10"
								>
									{#if job.company_logo}
										<img
											src={job.company_logo as string}
											alt={String(job.company)}
											class="h-10 w-10 rounded object-contain"
										/>
									{:else}
										<Briefcase class="h-6 w-6 text-primary" />
									{/if}
								</div>

								<div class="space-y-1">
									<h3 class="text-lg font-semibold">{job.title}</h3>
									<p class="text-muted-foreground">{job.company}</p>
									<div class="flex items-center gap-4 text-sm text-muted-foreground">
										{#if job.location}
											<span class="flex items-center gap-1">
												<MapPin class="h-3 w-3" />
												{job.location}
											</span>
										{/if}
										{#if job.is_remote}
											<Badge variant="outline">Remote</Badge>
										{/if}
										{#if job.salary_min || job.salary_max}
											<span>
												${job.salary_min?.toLocaleString() || '?'} - $
												{job.salary_max?.toLocaleString() || '?'}
											</span>
										{/if}
									</div>
								</div>
							</div>

							<div class="flex flex-col items-end gap-2">
								<div class="flex items-center gap-2">
									{#if job.match_score}
										<Badge variant={job.match_score >= 70 ? 'default' : 'secondary'}>
											{job.match_score}% match
										</Badge>
									{/if}

									<Badge variant={statusInfo.variant}>
										<statusInfo.icon class="mr-1 h-3 w-3" />
										{statusInfo.label}
									</Badge>
								</div>

								<div class="flex gap-2">
									<Button variant="outline" size="sm" href={job.source_url} target="_blank">
										<ExternalLink class="mr-1 h-3 w-3" />
										View Original
									</Button>
									<Button size="sm" href="/dashboard/jobs/{job.id}">
										View Details
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else}
		<Card>
			<CardContent class="py-12 text-center">
				<Briefcase class="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 class="mt-4 text-lg font-semibold">No jobs found</h3>
				<p class="mt-2 text-muted-foreground">
					{searchQuery || statusFilter !== 'all'
						? 'Try adjusting your filters'
						: 'Jobs will appear here once we find matches for your profile'}
				</p>
			</CardContent>
		</Card>
	{/if}
</div>
