<script lang="ts">
	import { cn } from '$lib/utils';
	import { Badge } from '$components/ui/badge';
	import { CheckCircle, XCircle, AlertCircle } from 'lucide-svelte';

	interface ATSScoreProps {
		score: number;
		keywordsMatched: string[];
		keywordsMissing: string[];
		suggestions?: string[];
		size?: 'sm' | 'md' | 'lg';
	}

	let {
		score,
		keywordsMatched = [],
		keywordsMissing = [],
		suggestions = [],
		size = 'md'
	}: ATSScoreProps = $props();

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
</script>

<div class="space-y-4">
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
				<span class={cn(scoreColor, 'text-xs font-medium')}>ATS</span>
			</div>
		</div>
	</div>

	<div class="space-y-3">
		<!-- Keywords Matched -->
		{#if keywordsMatched.length > 0}
			<div class="rounded-lg border bg-card p-3">
				<div class="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
					<CheckCircle class="h-4 w-4" />
					Keywords Matched ({keywordsMatched.length})
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each keywordsMatched.slice(0, 10) as keyword}
						<Badge variant="outline" class="border-green-600 text-green-600">
							{keyword}
						</Badge>
					{/each}
					{#if keywordsMatched.length > 10}
						<Badge variant="outline" class="text-muted-foreground">
							+{keywordsMatched.length - 10} more
						</Badge>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Keywords Missing -->
		{#if keywordsMissing.length > 0}
			<div class="rounded-lg border bg-card p-3">
				<div class="mb-2 flex items-center gap-2 text-sm font-medium text-red-600">
					<XCircle class="h-4 w-4" />
					Missing Keywords ({keywordsMissing.length})
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each keywordsMissing.slice(0, 10) as keyword}
						<Badge variant="outline" class="border-red-600 text-red-600">
							{keyword}
						</Badge>
					{/each}
					{#if keywordsMissing.length > 10}
						<Badge variant="outline" class="text-muted-foreground">
							+{keywordsMissing.length - 10} more
						</Badge>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Suggestions -->
		{#if suggestions.length > 0}
			<div class="rounded-lg border bg-card p-3">
				<div class="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
					<AlertCircle class="h-4 w-4" />
					Improvement Suggestions
				</div>
				<ul class="space-y-1.5 text-sm text-muted-foreground">
					{#each suggestions as suggestion}
						<li class="flex gap-2">
							<span class="text-orange-600">•</span>
							<span>{suggestion}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>
