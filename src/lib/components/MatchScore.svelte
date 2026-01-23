<script lang="ts">
	import { cn } from '$lib/utils';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	interface MatchScoreProps {
		score: number;
		breakdown?: {
			skillsMatch: number;
			experienceMatch: number;
			educationMatch: number;
		};
		showBreakdown?: boolean;
		size?: 'sm' | 'md' | 'lg';
	}

	let {
		score,
		breakdown,
		showBreakdown = false,
		size = 'md'
	}: MatchScoreProps = $props();

	let expanded = $state(false);

	const scoreColor = $derived(
		score >= 70 ? 'text-green-600' : score >= 50 ? 'text-orange-600' : 'text-red-600'
	);

	const strokeColor = $derived(
		score >= 70 ? 'stroke-green-600' : score >= 50 ? 'stroke-orange-600' : 'stroke-red-600'
	);

	const bgColor = $derived(
		score >= 70 ? 'bg-green-50 dark:bg-green-950' : score >= 50 ? 'bg-orange-50 dark:bg-orange-950' : 'bg-red-50 dark:bg-red-950'
	);

	const dimensions = $derived({
		sm: { size: 80, stroke: 6, fontSize: 'text-lg' },
		md: { size: 120, stroke: 8, fontSize: 'text-2xl' },
		lg: { size: 160, stroke: 10, fontSize: 'text-4xl' }
	}[size]);

	const radius = $derived(dimensions.size / 2 - dimensions.stroke);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (score / 100) * circumference);

	function getBreakdownColor(value: number): string {
		if (value >= 70) return 'text-green-600';
		if (value >= 50) return 'text-orange-600';
		return 'text-red-600';
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-center">
		<div class={cn('relative', bgColor, 'rounded-full p-4')}>
			<svg width={dimensions.size} height={dimensions.size} class="transform -rotate-90">
				<!-- Background circle -->
				<circle
					cx={dimensions.size / 2}
					cy={dimensions.size / 2}
					r={radius}
					stroke="currentColor"
					stroke-width={dimensions.stroke}
					fill="none"
					class="text-muted-foreground/20"
				/>
				<!-- Progress circle -->
				<circle
					cx={dimensions.size / 2}
					cy={dimensions.size / 2}
					r={radius}
					stroke="currentColor"
					stroke-width={dimensions.stroke}
					fill="none"
					stroke-dasharray={circumference}
					stroke-dashoffset={offset}
					stroke-linecap="round"
					class={cn(strokeColor, 'transition-all duration-500')}
				/>
			</svg>
			<!-- Score text -->
			<div
				class="absolute inset-0 flex flex-col items-center justify-center"
				style="top: {dimensions.stroke / 2}px"
			>
				<span class={cn(scoreColor, dimensions.fontSize, 'font-bold')}>{score}</span>
				<span class={cn(scoreColor, 'text-xs font-medium')}>Match</span>
			</div>
		</div>
	</div>

	{#if breakdown && showBreakdown}
		<div class="space-y-2">
			<button
				onclick={() => (expanded = !expanded)}
				class="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted/50"
			>
				<span>Why this score?</span>
				{#if expanded}
					<ChevronUp class="h-4 w-4" />
				{:else}
					<ChevronDown class="h-4 w-4" />
				{/if}
			</button>

			{#if expanded}
				<div class="space-y-3 rounded-lg border bg-card p-4">
					<!-- Skills Match -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium">Skills Match</span>
							<span class={cn('font-semibold', getBreakdownColor(breakdown.skillsMatch))}>
								{breakdown.skillsMatch}%
							</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								class={cn(
									'h-full transition-all',
									breakdown.skillsMatch >= 70
										? 'bg-green-600'
										: breakdown.skillsMatch >= 50
											? 'bg-orange-600'
											: 'bg-red-600'
								)}
								style="width: {breakdown.skillsMatch}%"
							></div>
						</div>
					</div>

					<!-- Experience Match -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium">Experience Match</span>
							<span class={cn('font-semibold', getBreakdownColor(breakdown.experienceMatch))}>
								{breakdown.experienceMatch}%
							</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								class={cn(
									'h-full transition-all',
									breakdown.experienceMatch >= 70
										? 'bg-green-600'
										: breakdown.experienceMatch >= 50
											? 'bg-orange-600'
											: 'bg-red-600'
								)}
								style="width: {breakdown.experienceMatch}%"
							></div>
						</div>
					</div>

					<!-- Education Match -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium">Education Match</span>
							<span class={cn('font-semibold', getBreakdownColor(breakdown.educationMatch))}>
								{breakdown.educationMatch}%
							</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								class={cn(
									'h-full transition-all',
									breakdown.educationMatch >= 70
										? 'bg-green-600'
										: breakdown.educationMatch >= 50
											? 'bg-orange-600'
											: 'bg-red-600'
								)}
								style="width: {breakdown.educationMatch}%"
							></div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
