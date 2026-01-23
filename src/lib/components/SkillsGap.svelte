<script lang="ts">
	import { Badge } from '$components/ui/badge';
	import { Button } from '$components/ui/button';
	import { CheckCircle, XCircle, AlertTriangle, ExternalLink, BookOpen, Award, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { getResourcesForSkills, getTopFreeResources, type LearningResource, type SkillResources } from '$lib/services/learning-resources';

	interface SkillsGapProps {
		matchedSkills: string[];
		missingRequired: string[];
		missingPreferred: string[];
		showLearningResources?: boolean;
	}

	let {
		matchedSkills = [],
		missingRequired = [],
		missingPreferred = [],
		showLearningResources = false
	}: SkillsGapProps = $props();

	const totalRequired = $derived(matchedSkills.length + missingRequired.length);
	const matchPercentage = $derived(
		totalRequired > 0 ? Math.round((matchedSkills.length / totalRequired) * 100) : 0
	);

	// Get learning resources for missing skills
	const requiredResources = $derived(getResourcesForSkills(missingRequired));
	const preferredResources = $derived(getResourcesForSkills(missingPreferred));
	const topFreeResources = $derived(getTopFreeResources([...missingRequired, ...missingPreferred], 5));

	let showAllResources = $state(false);

	function getPlatformColor(platform: LearningResource['platform']): string {
		switch (platform) {
			case 'Coursera': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
			case 'Udemy': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
			case 'LinkedIn Learning': return 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300';
			case 'freeCodeCamp': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
			case 'YouTube': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
			case 'Documentation': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
			default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
		}
	}
</script>

<div class="space-y-4">
	<!-- Summary -->
	<div class="rounded-lg border bg-card p-4">
		<div class="mb-3 flex items-center justify-between">
			<h4 class="font-semibold">Skills Overview</h4>
			<Badge variant={matchPercentage >= 70 ? 'default' : 'secondary'}>
				{matchPercentage}% Match
			</Badge>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between text-sm">
				<span class="text-muted-foreground">Required Skills</span>
				<span class="font-medium">
					{matchedSkills.length} of {totalRequired}
				</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full bg-primary transition-all"
					style="width: {matchPercentage}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Matched Skills -->
	{#if matchedSkills.length > 0}
		<div class="rounded-lg border bg-card p-4">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium text-green-600">
				<CheckCircle class="h-4 w-4" />
				You Have ({matchedSkills.length})
			</div>
			<div class="flex flex-wrap gap-2">
				{#each matchedSkills as skill}
					<Badge variant="outline" class="border-green-600 text-green-600">
						<CheckCircle class="mr-1 h-3 w-3" />
						{skill}
					</Badge>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Missing Required Skills -->
	{#if missingRequired.length > 0}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium text-red-600">
				<XCircle class="h-4 w-4" />
				Missing Required Skills ({missingRequired.length})
			</div>
			<div class="flex flex-wrap gap-2">
				{#each missingRequired as skill}
					<Badge variant="outline" class="border-red-600 bg-white text-red-600 dark:bg-transparent">
						<XCircle class="mr-1 h-3 w-3" />
						{skill}
					</Badge>
				{/each}
			</div>
			{#if showLearningResources && requiredResources.length > 0}
				<div class="mt-4 space-y-3">
					<div class="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
						<BookOpen class="h-4 w-4" />
						Learn These Skills
					</div>
					{#each requiredResources.slice(0, showAllResources ? undefined : 2) as skillResource}
						<div class="rounded border border-red-200 bg-white p-3 dark:border-red-800 dark:bg-red-950/50">
							<p class="mb-2 text-xs font-semibold text-red-700 dark:text-red-400">{skillResource.skill}</p>
							<div class="space-y-2">
								{#each skillResource.resources.slice(0, 2) as resource}
									<a
										href={resource.url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-start gap-2 rounded p-2 text-xs transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
									>
										<div class="flex-1">
											<p class="font-medium text-gray-900 dark:text-gray-100">{resource.title}</p>
											<div class="mt-1 flex flex-wrap items-center gap-2">
												<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {getPlatformColor(resource.platform)}">
													{resource.platform}
												</span>
												{#if resource.free}
													<span class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">Free</span>
												{/if}
												{#if resource.duration}
													<span class="text-[10px] text-muted-foreground">{resource.duration}</span>
												{/if}
												{#if resource.type === 'certification'}
													<Award class="h-3 w-3 text-amber-500" />
												{/if}
											</div>
										</div>
										<ExternalLink class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
									</a>
								{/each}
							</div>
						</div>
					{/each}
					{#if requiredResources.length > 2}
						<Button
							variant="ghost"
							size="sm"
							class="w-full text-red-600 hover:text-red-700"
							onclick={() => showAllResources = !showAllResources}
						>
							{#if showAllResources}
								<ChevronUp class="mr-1 h-4 w-4" /> Show Less
							{:else}
								<ChevronDown class="mr-1 h-4 w-4" /> Show {requiredResources.length - 2} More Skills
							{/if}
						</Button>
					{/if}
				</div>
			{:else if showLearningResources}
				<div class="mt-3 rounded border border-red-300 bg-white p-3 dark:border-red-800 dark:bg-red-950/50">
					<p class="text-xs text-red-600">
						Consider acquiring these skills to improve your match. Search online courses for "{missingRequired[0]}" to get started.
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Missing Preferred Skills -->
	{#if missingPreferred.length > 0}
		<div class="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium text-orange-600">
				<AlertTriangle class="h-4 w-4" />
				Missing Preferred Skills ({missingPreferred.length})
			</div>
			<div class="flex flex-wrap gap-2">
				{#each missingPreferred as skill}
					<Badge variant="outline" class="border-orange-600 bg-white text-orange-600 dark:bg-transparent">
						<AlertTriangle class="mr-1 h-3 w-3" />
						{skill}
					</Badge>
				{/each}
			</div>
			{#if showLearningResources && preferredResources.length > 0}
				<div class="mt-4 space-y-3">
					<div class="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
						<BookOpen class="h-4 w-4" />
						Strengthen Your Application
					</div>
					{#each preferredResources.slice(0, 2) as skillResource}
						<div class="rounded border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-orange-950/50">
							<p class="mb-2 text-xs font-semibold text-orange-700 dark:text-orange-400">{skillResource.skill}</p>
							<div class="space-y-2">
								{#each skillResource.resources.slice(0, 1) as resource}
									<a
										href={resource.url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-start gap-2 rounded p-2 text-xs transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/50"
									>
										<div class="flex-1">
											<p class="font-medium text-gray-900 dark:text-gray-100">{resource.title}</p>
											<div class="mt-1 flex flex-wrap items-center gap-2">
												<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {getPlatformColor(resource.platform)}">
													{resource.platform}
												</span>
												{#if resource.free}
													<span class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">Free</span>
												{/if}
											</div>
										</div>
										<ExternalLink class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="mt-3 rounded border border-orange-300 bg-white p-3 dark:border-orange-800 dark:bg-orange-950/50">
					<p class="text-xs text-orange-600">
						These skills are nice to have but not required. Adding them could strengthen your application.
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Quick Start Free Resources -->
	{#if showLearningResources && topFreeResources.length > 0 && (missingRequired.length > 0 || missingPreferred.length > 0)}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
				<Award class="h-4 w-4" />
				Start Learning Free Today
			</div>
			<div class="space-y-2">
				{#each topFreeResources.slice(0, 3) as resource}
					<a
						href={resource.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-3 rounded-lg border border-green-200 bg-white p-3 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-950/50 dark:hover:bg-green-900/50"
					>
						<div class="flex-1">
							<p class="text-sm font-medium text-gray-900 dark:text-gray-100">{resource.title}</p>
							<div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
								<span class="rounded px-1.5 py-0.5 {getPlatformColor(resource.platform)}">
									{resource.platform}
								</span>
								{#if resource.duration}
									<span>{resource.duration}</span>
								{/if}
							</div>
						</div>
						<ExternalLink class="h-4 w-4 text-green-600" />
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- No Skills Gap -->
	{#if matchedSkills.length > 0 && missingRequired.length === 0 && missingPreferred.length === 0}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
			<div class="flex items-center gap-2 text-sm font-medium text-green-600">
				<CheckCircle class="h-4 w-4" />
				Perfect Match! You have all the required and preferred skills.
			</div>
		</div>
	{/if}
</div>
