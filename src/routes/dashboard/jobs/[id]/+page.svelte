<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Textarea } from '$components/ui/textarea';
	import MatchScore from '$lib/components/MatchScore.svelte';
	import ATSScore from '$lib/components/ATSScore.svelte';
	import SkillsGap from '$lib/components/SkillsGap.svelte';
	import {
		ArrowLeft,
		Briefcase,
		CheckCircle,
		Clock,
		Copy,
		Download,
		ExternalLink,
		FileText,
		Mail,
		MapPin,
		ThumbsDown,
		ThumbsUp,
		XCircle
	} from 'lucide-svelte';
	import EmailTemplates from '$lib/components/EmailTemplates.svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	let { data }: { data: PageData } = $props();

	let activeTab = $state<'resume' | 'cover' | 'emails'>('resume');
	let feedbackReason = $state('');

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toast.success('Copied to clipboard');
	}
</script>

<svelte:head>
	<title>{data.job?.title} - HowlerHire</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-4 sm:px-6 lg:px-8">
	<!-- Back button -->
	<Button variant="ghost" href="/dashboard/jobs">
		<ArrowLeft class="mr-2 h-4 w-4" />
		Back to Jobs
	</Button>

	{#if data.job}
		<!-- Job Header -->
		<Card>
			<CardContent class="pt-6">
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
					<div class="grid grid-cols-[auto_1fr] gap-4">
						<div class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
							{#if data.job.company_logo}
								<img
									src={data.job.company_logo}
									alt={data.job.company}
									class="h-12 w-12 rounded object-contain"
								/>
							{:else}
								<Briefcase class="h-8 w-8 text-primary" />
							{/if}
						</div>

						<div class="min-w-0">
							<h1 class="truncate text-2xl font-bold">{data.job.title}</h1>
							<p class="truncate text-lg text-muted-foreground">{data.job.company}</p>
							<div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								{#if data.job.location}
									<span class="flex items-center gap-1">
										<MapPin class="h-4 w-4 flex-shrink-0" />
										<span class="truncate">{data.job.location}</span>
									</span>
								{/if}
								{#if data.job.is_remote}
									<Badge variant="outline">Remote</Badge>
								{/if}
								{#if data.job.employment_type}
									<span class="whitespace-nowrap">{data.job.employment_type}</span>
								{/if}
								{#if data.job.status}
									{@const statusMap = {
										saved: { label: 'Saved', variant: 'outline' as const },
										applied: { label: 'Applied', variant: 'default' as const },
										interview: { label: 'Interview', variant: 'default' as const },
										offer: { label: 'Offer', variant: 'default' as const },
										rejected: { label: 'Rejected', variant: 'secondary' as const }
									}}
									{@const status = statusMap[data.job.status as keyof typeof statusMap]}
									{#if status}
										<Badge variant={status.variant}>{status.label}</Badge>
									{/if}
								{/if}
							</div>
						</div>
					</div>

					<div class="flex items-start gap-2 lg:flex-col lg:items-end">
						<Button variant="outline" href={data.job.source_url} target="_blank" class="w-full lg:w-auto">
							<ExternalLink class="mr-2 h-4 w-4" />
							View Original
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Match Scores -->
		<div class="grid gap-6 md:grid-cols-3">
			<!-- Match Score -->
			{#if data.job.match_score && data.matchBreakdown}
				<Card>
					<CardHeader>
						<CardTitle class="text-base">Match Score</CardTitle>
						<CardDescription>How well you match this role</CardDescription>
					</CardHeader>
					<CardContent>
						<MatchScore
							score={data.job.match_score}
							breakdown={data.matchBreakdown}
							showBreakdown={true}
							size="md"
						/>
					</CardContent>
				</Card>
			{/if}

			<!-- ATS Score -->
			{#if data.atsAnalysis}
				<Card>
					<CardHeader>
						<CardTitle class="text-base">ATS Score</CardTitle>
						<CardDescription>How ATS systems will rate you</CardDescription>
					</CardHeader>
					<CardContent>
						<ATSScore
							score={data.atsAnalysis.score}
							keywordsMatched={data.atsAnalysis.keywordsMatched}
							keywordsMissing={data.atsAnalysis.keywordsMissing}
							suggestions={data.atsAnalysis.suggestions}
							size="md"
						/>
					</CardContent>
				</Card>
			{/if}

			<!-- Skills Gap -->
			{#if data.skillsGap}
				<Card>
					<CardHeader>
						<CardTitle class="text-base">Skills Analysis</CardTitle>
						<CardDescription>Your skill alignment with requirements</CardDescription>
					</CardHeader>
					<CardContent>
						<SkillsGap
							matchedSkills={data.skillsGap.matchedSkills}
							missingRequired={data.skillsGap.missingRequired}
							missingPreferred={data.skillsGap.missingPreferred}
							showLearningResources={true}
						/>
					</CardContent>
				</Card>
			{/if}
		</div>

		<!-- Actions -->
		<Card>
			<CardHeader>
				<CardTitle>Actions</CardTitle>
				<CardDescription>Update the status of this job application</CardDescription>
			</CardHeader>
			<CardContent>
				<form method="POST" use:enhance class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
					<input type="hidden" name="jobId" value={data.job.id} />

					<Button type="submit" formaction="?/markSaved" variant="outline" class="w-full">
						<Clock class="mr-2 h-4 w-4" />
						Save for Later
					</Button>

					<Button
						type="submit"
						formaction="?/markApplied"
						variant={data.job.status === 'applied' ? 'default' : 'outline'}
						class="w-full"
					>
						<CheckCircle class="mr-2 h-4 w-4" />
						Mark as Applied
					</Button>

					<Button type="submit" formaction="?/markInterview" variant="outline" class="w-full">
						Interview Scheduled
					</Button>

					<Button type="submit" formaction="?/markOffer" variant="outline" class="w-full">
						Received Offer
					</Button>

					<Button
						type="submit"
						formaction="?/markRejected"
						variant="outline"
						class="w-full"
					>
						<XCircle class="mr-2 h-4 w-4" />
						Rejected
					</Button>

					<Button
						type="submit"
						formaction="?/markNotRelevant"
						variant={data.job.status === 'not_relevant' ? 'default' : 'outline'}
						class="w-full"
					>
						Not Relevant
					</Button>
				</form>

				<!-- Feedback -->
				<div class="mt-6 border-t pt-6">
					<h4 class="mb-2 font-medium">Was this a good match?</h4>
					<form method="POST" action="?/submitFeedback" use:enhance class="space-y-4">
						<input type="hidden" name="jobId" value={data.job.id} />

						<div class="flex flex-wrap gap-2">
							<Button
								type="submit"
								name="feedback"
								value="good_match"
								variant={data.job.user_feedback === 'good_match' ? 'default' : 'outline'}
								size="sm"
							>
								<ThumbsUp class="mr-2 h-4 w-4" />
								Good Match
							</Button>
							<Button
								type="submit"
								name="feedback"
								value="bad_match"
								variant={data.job.user_feedback === 'bad_match' ? 'default' : 'outline'}
								size="sm"
							>
								<ThumbsDown class="mr-2 h-4 w-4" />
								Bad Match
							</Button>
						</div>

						{#if data.job.user_feedback === 'bad_match'}
							<div class="space-y-2">
								<label for="reason" class="text-sm font-medium">
									What made this a bad match? (optional)
								</label>
								<Textarea
									id="reason"
									name="reason"
									placeholder="e.g., Wrong skill set, wrong location, salary too low..."
									bind:value={feedbackReason}
									class="max-w-full"
								/>
								<Button type="submit" size="sm">Submit Feedback</Button>
							</div>
						{/if}
					</form>
				</div>
			</CardContent>
		</Card>

		<!-- Generated Documents -->
		{#if data.application}
			<Card>
				<CardHeader>
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
						<div>
							<CardTitle>Generated Documents</CardTitle>
							<CardDescription>
								{#if data.application.status === 'ready'}
									Your tailored resume and cover letter are ready
								{:else if data.application.status === 'generating'}
									Generating your documents...
								{:else}
									Status: {data.application.status}
								{/if}
							</CardDescription>
						</div>

						<div class="flex flex-wrap gap-2 lg:items-start">
							<Button
								variant={activeTab === 'resume' ? 'default' : 'outline'}
								size="sm"
								onclick={() => (activeTab = 'resume')}
								class="flex-1 sm:flex-initial"
							>
								<FileText class="mr-2 h-4 w-4" />
								Resume
							</Button>
							<Button
								variant={activeTab === 'cover' ? 'default' : 'outline'}
								size="sm"
								onclick={() => (activeTab = 'cover')}
								class="flex-1 sm:flex-initial"
							>
								<FileText class="mr-2 h-4 w-4" />
								Cover Letter
							</Button>
							<Button
								variant={activeTab === 'emails' ? 'default' : 'outline'}
								size="sm"
								onclick={() => (activeTab = 'emails')}
								class="flex-1 sm:flex-initial"
							>
								<Mail class="mr-2 h-4 w-4" />
								Follow-up Emails
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{#if data.application.status === 'generating'}
						<div class="flex items-center justify-center py-12">
							<div class="text-center">
								<div
									class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
								></div>
								<p class="mt-4 text-muted-foreground">Generating your documents...</p>
							</div>
						</div>
					{:else if data.application.status === 'ready'}
						<div class="space-y-4">
							<div class="flex flex-wrap justify-end gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() =>
										copyToClipboard(
											activeTab === 'resume'
												? data.application?.tailored_resume || ''
												: data.application?.cover_letter || ''
										)}
								>
									<Copy class="mr-2 h-4 w-4" />
									Copy
								</Button>
								<Button variant="outline" size="sm">
									<Download class="mr-2 h-4 w-4" />
									Download PDF
								</Button>
							</div>

							<div class="overflow-x-auto rounded-lg border bg-muted/30 p-6">
								<div class="prose prose-sm max-w-none break-words dark:prose-invert">
									{#if activeTab === 'resume'}
										{@html data.application.tailored_resume?.replace(/\n/g, '<br>') ||
											'No resume generated yet'}
									{:else}
										{@html data.application.cover_letter?.replace(/\n/g, '<br>') ||
											'No cover letter generated yet'}
									{/if}
								</div>
							</div>
						</div>
					{:else if data.application.status === 'error'}
						<div class="rounded-lg bg-destructive/10 p-4 text-destructive">
							<p class="font-medium">Generation failed</p>
							<p class="mt-1 text-sm">{data.application.error_message}</p>
							<form method="POST" action="?/regenerate" use:enhance class="mt-4">
								<input type="hidden" name="applicationId" value={data.application.id} />
								<Button type="submit" variant="outline" size="sm">Try Again</Button>
							</form>
						</div>
					{/if}

					{#if activeTab === 'emails'}
						<div class="mt-6 border-t pt-6">
							<EmailTemplates
								candidateName={data.profile?.full_name || 'Your Name'}
								jobTitle={data.job.title}
								companyName={data.job.company}
								applicationDate={data.job.created_at ? new Date(data.job.created_at) : undefined}
							/>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}

		<!-- Job Description -->
		<Card>
			<CardHeader>
				<CardTitle>Job Description</CardTitle>
			</CardHeader>
			<CardContent>
				{#if data.job.description}
					<div class="overflow-x-auto">
						<div class="prose prose-sm max-w-none break-words dark:prose-invert">
							{@html data.job.description.replace(/\n/g, '<br>')}
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground">No description available</p>
				{/if}

				{#if data.job.requirements && data.job.requirements.length > 0}
					<div class="mt-6">
						<h4 class="mb-2 font-semibold">Requirements</h4>
						<ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
							{#each data.job.requirements as req}
								<li class="break-words">{req}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardContent class="py-12 text-center">
				<p class="text-muted-foreground">Job not found</p>
				<Button class="mt-4" href="/dashboard/jobs">Back to Jobs</Button>
			</CardContent>
		</Card>
	{/if}
</div>
