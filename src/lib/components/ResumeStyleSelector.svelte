<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Check, Crown, Sparkles, Filter } from 'lucide-svelte';

	interface StyleInfo {
		id: string;
		name: string;
		description: string;
		industries: string[];
		tags: string[];
		premium: boolean;
		atsOptimized: boolean;
		previewImage: string;
	}

	interface Props {
		styles: StyleInfo[];
		selectedStyleId: string;
		recommendedStyleId?: string;
		userTier?: 'free' | 'pro' | 'premium';
		onSelect: (styleId: string) => void;
	}

	let {
		styles,
		selectedStyleId,
		recommendedStyleId,
		userTier = 'free',
		onSelect
	}: Props = $props();

	let filterIndustry = $state<string | null>(null);
	let showOnlyFree = $state(false);

	// Get unique industries from all styles
	const allIndustries = $derived(() => {
		const industries = new Set<string>();
		styles.forEach((style) => {
			style.industries.forEach((ind) => industries.add(ind));
		});
		return Array.from(industries).sort();
	});

	// Filter styles based on current filters
	const filteredStyles = $derived(() => {
		let result = styles;

		if (filterIndustry) {
			result = result.filter((style) => style.industries.includes(filterIndustry as string));
		}

		if (showOnlyFree) {
			result = result.filter((style) => !style.premium);
		}

		// Sort: recommended first, then non-premium, then alphabetically
		return result.sort((a, b) => {
			if (a.id === recommendedStyleId) return -1;
			if (b.id === recommendedStyleId) return 1;
			if (!a.premium && b.premium) return -1;
			if (a.premium && !b.premium) return 1;
			return a.name.localeCompare(b.name);
		});
	});

	function canSelect(style: StyleInfo): boolean {
		if (!style.premium) return true;
		return userTier === 'pro' || userTier === 'premium';
	}

	function handleSelect(styleId: string) {
		const style = styles.find((s) => s.id === styleId);
		if (style && canSelect(style)) {
			onSelect(styleId);
		}
	}

	function formatIndustry(industry: string): string {
		return industry
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

<div class="space-y-6">
	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<Filter class="h-4 w-4 text-muted-foreground" />
			<span class="text-sm font-medium">Filter by:</span>
		</div>

		<select
			bind:value={filterIndustry}
			class="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
		>
			<option value={null}>All Industries</option>
			{#each allIndustries() as industry}
				<option value={industry}>{formatIndustry(industry)}</option>
			{/each}
		</select>

		{#if userTier === 'free'}
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={showOnlyFree} class="rounded border-input" />
				Show only free styles
			</label>
		{/if}

		{#if filterIndustry || showOnlyFree}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => {
					filterIndustry = null;
					showOnlyFree = false;
				}}
			>
				Clear filters
			</Button>
		{/if}
	</div>

	<!-- Style Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each filteredStyles() as style (style.id)}
			{@const isSelected = style.id === selectedStyleId}
			{@const isRecommended = style.id === recommendedStyleId}
			{@const canUse = canSelect(style)}

			<button
				type="button"
				onclick={() => handleSelect(style.id)}
				disabled={!canUse}
				class="group relative text-left transition-all {isSelected
					? 'ring-2 ring-primary ring-offset-2'
					: canUse
						? 'hover:ring-2 hover:ring-primary/50 hover:ring-offset-1'
						: 'cursor-not-allowed opacity-60'}"
			>
				<Card class="h-full overflow-hidden">
					<!-- Preview Image -->
					<div
						class="relative aspect-[8.5/11] overflow-hidden bg-muted {canUse
							? 'group-hover:brightness-95'
							: ''}"
					>
						<img
							src={style.previewImage}
							alt="{style.name} preview"
							class="h-full w-full object-cover object-top"
						/>

						<!-- Selected Overlay -->
						{#if isSelected}
							<div
								class="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[1px]"
							>
								<div class="rounded-full bg-primary p-2">
									<Check class="h-6 w-6 text-primary-foreground" />
								</div>
							</div>
						{/if}

						<!-- Badges -->
						<div class="absolute right-2 top-2 flex flex-col gap-1">
							{#if isRecommended}
								<Badge variant="default" class="gap-1 bg-green-600">
									<Sparkles class="h-3 w-3" />
									Recommended
								</Badge>
							{/if}
							{#if style.premium}
								<Badge variant="secondary" class="gap-1">
									<Crown class="h-3 w-3" />
									Premium
								</Badge>
							{/if}
						</div>

						<!-- ATS Badge -->
						{#if style.atsOptimized}
							<div class="absolute bottom-2 left-2">
								<Badge variant="outline" class="bg-background/80 text-xs">ATS-Friendly</Badge>
							</div>
						{/if}
					</div>

					<!-- Style Info -->
					<CardContent class="p-3">
						<h3 class="font-semibold">{style.name}</h3>
						<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
							{style.description}
						</p>

						<!-- Tags -->
						<div class="mt-2 flex flex-wrap gap-1">
							{#each style.tags.slice(0, 3) as tag}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
									{tag}
								</span>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Locked Overlay for Premium -->
				{#if style.premium && !canUse}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm"
					>
						<div class="text-center">
							<Crown class="mx-auto h-8 w-8 text-amber-500" />
							<p class="mt-2 text-sm font-medium">Premium - Coming Soon</p>
							<Button variant="outline" size="sm" class="mt-2" href="/dashboard/subscription">
								Join Waitlist
							</Button>
						</div>
					</div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Empty State -->
	{#if filteredStyles().length === 0}
		<div class="py-12 text-center">
			<p class="text-muted-foreground">No styles match your filters.</p>
			<Button
				variant="link"
				onclick={() => {
					filterIndustry = null;
					showOnlyFree = false;
				}}
			>
				Clear all filters
			</Button>
		</div>
	{/if}
</div>
