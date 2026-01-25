<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Zap } from 'lucide-svelte';

	interface UsageData {
		job_matches_count: number;
		job_matches_limit: number;
		resume_generations_count: number;
		resume_generations_limit: number;
		week_start_date: string;
	}

	let { usage }: { usage: UsageData | null } = $props();

	const matchesPercentage = $derived(
		usage ? Math.round((usage.job_matches_count / usage.job_matches_limit) * 100) : 0
	);
	const generationsPercentage = $derived(
		usage ? Math.round((usage.resume_generations_count / usage.resume_generations_limit) * 100) : 0
	);

	const matchesRemaining = $derived(
		usage ? usage.job_matches_limit - usage.job_matches_count : 5
	);
	const generationsRemaining = $derived(
		usage ? usage.resume_generations_limit - usage.resume_generations_count : 5
	);

	function getWeekEnd(weekStart: string): string {
		const start = new Date(weekStart);
		const end = new Date(start);
		end.setDate(end.getDate() + 6);
		return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getProgressColor(percentage: number): string {
		if (percentage >= 100) return 'bg-destructive';
		if (percentage >= 80) return 'bg-orange-500';
		return 'bg-primary';
	}
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle class="flex items-center gap-2">
					<Zap class="h-5 w-5" />
					Free Tier Usage
				</CardTitle>
				<CardDescription>
					Resets weekly
					{#if usage}
						(ends {getWeekEnd(usage.week_start_date)})
					{/if}
				</CardDescription>
			</div>
			<Badge variant="outline">Free</Badge>
		</div>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Job Matches -->
		<div class="space-y-2">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium">Job Matches</span>
				<span class="text-muted-foreground">
					{usage?.job_matches_count || 0} / {usage?.job_matches_limit || 5}
				</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-muted">
				<div
					class={`h-full transition-all ${getProgressColor(matchesPercentage)}`}
					style="width: {matchesPercentage}%"
				></div>
			</div>
			<p class="text-xs text-muted-foreground">
				{matchesRemaining} {matchesRemaining === 1 ? 'match' : 'matches'} remaining this week
			</p>
		</div>

		<!-- Resume Generations -->
		<div class="space-y-2">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium">Resume Generations</span>
				<span class="text-muted-foreground">
					{usage?.resume_generations_count || 0} / {usage?.resume_generations_limit || 5}
				</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-muted">
				<div
					class={`h-full transition-all ${getProgressColor(generationsPercentage)}`}
					style="width: {generationsPercentage}%"
				></div>
			</div>
			<p class="text-xs text-muted-foreground">
				{generationsRemaining} {generationsRemaining === 1 ? 'generation' : 'generations'} remaining this week
			</p>
		</div>

		{#if matchesPercentage >= 100 || generationsPercentage >= 100}
			<a href="/dashboard/subscription" class="block rounded-lg bg-muted p-3 text-sm transition-colors hover:bg-muted/80">
				<p class="font-medium">Want more? Pro plans coming soon!</p>
				<p class="text-muted-foreground mt-1">Join the waitlist to get notified</p>
			</a>
		{/if}
	</CardContent>
</Card>
