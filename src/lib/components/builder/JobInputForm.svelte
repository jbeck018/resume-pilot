<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Textarea } from '$components/ui/textarea';
	import { Label } from '$components/ui/label';
	import { Link, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-svelte';

	interface JobInfo {
		title: string;
		company: string;
		description: string;
		requirements: string[];
		location?: string;
		salary?: string;
		sourceUrl?: string;
	}

	interface Props {
		onJobParsed: (job: JobInfo) => void;
	}

	let { onJobParsed }: Props = $props();

	let mode = $state<'url' | 'text'>('url');
	let urlValue = $state('');
	let textValue = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	async function handleUrlSubmit(e: Event) {
		e.preventDefault();
		if (!urlValue.trim() || isLoading) return;

		isLoading = true;
		error = null;
		success = false;

		try {
			const response = await fetch('/api/builder/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: urlValue.trim() })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to scrape job URL');
			}

			success = true;
			onJobParsed(data.job);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handleTextSubmit(e: Event) {
		e.preventDefault();
		if (!textValue.trim() || isLoading) return;

		isLoading = true;
		error = null;
		success = false;

		try {
			const response = await fetch('/api/builder/parse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: textValue.trim() })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to parse job description');
			}

			success = true;
			onJobParsed(data.job);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="space-y-4">
	<!-- Mode Toggle -->
	<div class="flex gap-2">
		<Button
			variant={mode === 'url' ? 'default' : 'outline'}
			size="sm"
			onclick={() => (mode = 'url')}
			class="flex-1"
		>
			<Link class="mr-2 h-4 w-4" />
			Job URL
		</Button>
		<Button
			variant={mode === 'text' ? 'default' : 'outline'}
			size="sm"
			onclick={() => (mode = 'text')}
			class="flex-1"
		>
			<FileText class="mr-2 h-4 w-4" />
			Paste Text
		</Button>
	</div>

	{#if mode === 'url'}
		<form onsubmit={handleUrlSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="job-url">Job Posting URL</Label>
				<Input
					id="job-url"
					type="url"
					placeholder="https://jobs.lever.co/company/job-id"
					bind:value={urlValue}
					disabled={isLoading}
				/>
				<p class="text-xs text-muted-foreground">
					Supports Lever, Greenhouse, LinkedIn, and most job boards
				</p>
			</div>
			<Button type="submit" class="w-full" disabled={isLoading || !urlValue.trim()}>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Scraping job posting...
				{:else}
					Analyze Job Posting
				{/if}
			</Button>
		</form>
	{:else}
		<form onsubmit={handleTextSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="job-text">Job Description</Label>
				<Textarea
					id="job-text"
					placeholder="Paste the job description here..."
					class="min-h-[200px]"
					bind:value={textValue}
					disabled={isLoading}
				/>
				<p class="text-xs text-muted-foreground">
					Copy and paste the full job description including requirements
				</p>
			</div>
			<Button type="submit" class="w-full" disabled={isLoading || textValue.length < 50}>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Analyzing job description...
				{:else}
					Analyze Job Description
				{/if}
			</Button>
		</form>
	{/if}

	{#if error}
		<div class="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
			<AlertCircle class="h-4 w-4 shrink-0" />
			<span>{error}</span>
		</div>
	{/if}

	{#if success}
		<div class="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
			<CheckCircle class="h-4 w-4 shrink-0" />
			<span>Job analyzed successfully! Start chatting to build your resume.</span>
		</div>
	{/if}
</div>
