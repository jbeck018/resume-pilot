<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import {
		Briefcase,
		CheckCircle,
		Clock,
		XCircle,
		FileText,
		LayoutList,
		LayoutGrid,
		Search,
		Filter,
		TrendingUp,
		Calendar,
		Building2
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	type ApplicationData = {
		id: string;
		title: string;
		company: string;
		status: string;
		location?: string;
		match_score?: number;
		created_at?: string;
		applied_at?: string;
		[key: string]: unknown;
	};

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let selectedStatus = $state('all');
	let view = $state<'list' | 'kanban'>('list');
	let filtersInitialized = $state(false);

	// Sync filter state with URL params on initial load
	$effect(() => {
		if (data.filters && !filtersInitialized) {
			selectedStatus = data.filters.status || 'all';
			view = (data.filters.view as 'list' | 'kanban') || 'list';
			filtersInitialized = true;
		}
	});

	const applications = $derived((data.applications || []) as ApplicationData[]);

	const filteredApplications = $derived(
		applications.filter((app) => {
			const matchesSearch =
				!searchQuery ||
				app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				app.company.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesSearch;
		})
	);

	const statusGroups = $derived({
		saved: filteredApplications.filter((app) => app.status === 'saved'),
		applied: filteredApplications.filter((app) => app.status === 'applied'),
		interview: filteredApplications.filter((app) => app.status === 'interview'),
		offer: filteredApplications.filter((app) => app.status === 'offer'),
		rejected: filteredApplications.filter((app) => app.status === 'rejected')
	});

	function getStatusBadge(status: string) {
		const configs = {
			saved: { variant: 'outline' as const, icon: Clock, label: 'Saved' },
			applied: { variant: 'secondary' as const, icon: CheckCircle, label: 'Applied' },
			interview: { variant: 'default' as const, icon: Calendar, label: 'Interview' },
			offer: { variant: 'default' as const, icon: TrendingUp, label: 'Offer' },
			rejected: { variant: 'secondary' as const, icon: XCircle, label: 'Rejected' },
			pending: { variant: 'outline' as const, icon: Clock, label: 'Pending' }
		};

		return configs[status as keyof typeof configs] || configs.pending;
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (selectedStatus !== 'all') params.set('status', selectedStatus);
		params.set('sort', data.filters.sortBy);
		params.set('view', view);
		goto(`?${params.toString()}`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>Applications - Resume Pilot</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Application Tracker</h1>
			<p class="text-muted-foreground">Track and manage your job applications</p>
		</div>

		<div class="flex gap-2">
			<Button
				variant={view === 'list' ? 'default' : 'outline'}
				size="sm"
				onclick={() => {
					view = 'list';
					applyFilters();
				}}
			>
				<LayoutList class="mr-2 h-4 w-4" />
				List
			</Button>
			<Button
				variant={view === 'kanban' ? 'default' : 'outline'}
				size="sm"
				onclick={() => {
					view = 'kanban';
					applyFilters();
				}}
			>
				<LayoutGrid class="mr-2 h-4 w-4" />
				Board
			</Button>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-6">
		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold">{data.stats?.total || 0}</div>
					<p class="text-xs text-muted-foreground">Total</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-yellow-600">{data.stats?.saved || 0}</div>
					<p class="text-xs text-muted-foreground">Saved</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{data.stats?.applied || 0}</div>
					<p class="text-xs text-muted-foreground">Applied</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-purple-600">{data.stats?.interviewing || 0}</div>
					<p class="text-xs text-muted-foreground">Interviewing</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{data.stats?.offer || 0}</div>
					<p class="text-xs text-muted-foreground">Offers</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="pt-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-red-600">{data.stats?.rejected || 0}</div>
					<p class="text-xs text-muted-foreground">Rejected</p>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="pt-6">
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex-1">
					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="text"
							placeholder="Search by company or position..."
							bind:value={searchQuery}
							class="pl-9"
						/>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" />
					<select
						bind:value={selectedStatus}
						onchange={applyFilters}
						class="rounded-md border bg-background px-3 py-2 text-sm"
					>
						<option value="all">All Status</option>
						<option value="saved">Saved</option>
						<option value="applied">Applied</option>
						<option value="interview">Interview</option>
						<option value="offer">Offer</option>
						<option value="rejected">Rejected</option>
					</select>
				</div>
			</div>
		</CardContent>
	</Card>

	{#if view === 'list'}
		<!-- List View -->
		<Card>
			<CardHeader>
				<CardTitle>Applications</CardTitle>
				<CardDescription>
					{filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if filteredApplications.length > 0}
					<div class="space-y-3">
						{#each filteredApplications as app}
							<div
								class="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
							>
								<div class="flex items-center gap-4">
									<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
										{#if app.company_logo}
											<img
												src={app.company_logo as string}
												alt={String(app.company)}
												class="h-10 w-10 rounded object-contain"
											/>
										{:else}
											<Briefcase class="h-6 w-6 text-primary" />
										{/if}
									</div>

									<div>
										<h3 class="font-semibold">{app.title}</h3>
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<Building2 class="h-3 w-3" />
											<span>{app.company}</span>
											{#if app.location}
												<span>•</span>
												<span>{app.location}</span>
											{/if}
										</div>
										{#if app.applied_at}
											<p class="text-xs text-muted-foreground">
												Applied {new Date(app.applied_at).toLocaleDateString()}
											</p>
										{/if}
									</div>
								</div>

								<div class="flex items-center gap-3">
									{#if app.match_score}
										<Badge variant={app.match_score >= 70 ? 'default' : 'secondary'}>
											{app.match_score}% match
										</Badge>
									{/if}

									<Badge variant={getStatusBadge(app.status).variant}>
										{#if true}
											{@const StatusIcon = getStatusBadge(app.status).icon}
											<StatusIcon class="mr-1 h-3 w-3" />
										{/if}
										{getStatusBadge(app.status).label}
									</Badge>

									<Button variant="outline" size="sm" href="/dashboard/jobs/{app.id}">
										View
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-12 text-center">
						<Briefcase class="mx-auto h-12 w-12 text-muted-foreground" />
						<h3 class="mt-4 text-lg font-semibold">No applications found</h3>
						<p class="mt-2 text-muted-foreground">
							{searchQuery
								? 'Try adjusting your search or filters'
								: 'Start applying to jobs to track them here'}
						</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<!-- Kanban View -->
		<div class="grid gap-4 md:grid-cols-5">
			{#each Object.entries(statusGroups) as [status, apps]}
				{@const statusConfig = getStatusBadge(status)}
				<Card>
					<CardHeader>
						<div class="flex items-center justify-between">
							<CardTitle class="text-base font-medium">
								{statusConfig.label}
							</CardTitle>
							<Badge variant="outline">{apps.length}</Badge>
						</div>
					</CardHeader>
					<CardContent class="space-y-3">
						{#each apps as app}
							<div class="rounded-lg border bg-card p-3 hover:bg-muted/50">
								<h4 class="mb-1 font-semibold text-sm">{app.title}</h4>
								<p class="mb-2 text-xs text-muted-foreground">{app.company}</p>
								{#if app.match_score}
									<Badge variant="outline" class="text-xs">
										{app.match_score}% match
									</Badge>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									class="mt-2 w-full"
									href="/dashboard/jobs/{app.id}"
								>
									<FileText class="mr-1 h-3 w-3" />
									View
								</Button>
							</div>
						{/each}

						{#if apps.length === 0}
							<div class="rounded-lg border border-dashed p-6 text-center">
								<p class="text-xs text-muted-foreground">No applications</p>
							</div>
						{/if}
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>
