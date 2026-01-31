<script lang="ts">
	import { ChatInterface, JobInputForm, ResumeSheet } from '$lib/components/builder';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { FileText, MessageSquare, Sparkles, AlertCircle } from 'lucide-svelte';

	let { data } = $props();

	interface Message {
		id: string;
		role: 'user' | 'assistant';
		content: string;
	}

	interface JobInfo {
		title: string;
		company: string;
		description: string;
		requirements: string[];
		location?: string;
		salary?: string;
		sourceUrl?: string;
		skills?: string[];
	}

	interface ResumeData {
		name: string;
		email?: string;
		phone?: string;
		location?: string;
		linkedin?: string;
		website?: string;
		summary?: string;
		experience?: any[];
		education?: any[];
		skills?: string[];
		certifications?: string[];
	}

	let currentJob = $state<JobInfo | null>(null);
	let messages = $state<Message[]>([]);
	let isLoading = $state(false);
	let sheetOpen = $state(false);
	let generatedResume = $state<ResumeData | null>(null);

	// Initialize resume from profile data if available
	$effect(() => {
		if (data.profile && !generatedResume) {
			generatedResume = {
				name: data.profile.name,
				email: data.profile.email,
				phone: data.profile.phone,
				location: data.profile.location,
				linkedin: data.profile.linkedin,
				website: data.profile.website,
				skills: data.profile.skills,
				experience: data.profile.experience,
				education: data.profile.education
			};
		}
	});

	function handleJobParsed(job: JobInfo) {
		currentJob = job;

		// Add an initial assistant message
		messages = [
			{
				id: crypto.randomUUID(),
				role: 'assistant',
				content: `Great! I've analyzed the **${job.title}** position at **${job.company}**.

${job.requirements?.length ? `Key requirements I noticed:\n${job.requirements.slice(0, 5).map((r) => `• ${r}`).join('\n')}` : ''}

I can help you tailor your resume to highlight your relevant experience. What would you like to start with?

1. Review and improve your professional summary
2. Tailor your work experience to match this role
3. Highlight relevant skills
4. Something else specific?`
			}
		];
	}

	async function handleSendMessage(content: string) {
		// Add user message
		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content
		};
		messages = [...messages, userMessage];
		isLoading = true;

		try {
			const response = await fetch('/api/builder/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.map((m) => ({ role: m.role, content: m.content })),
					jobInfo: currentJob,
					profileSummary: data.profileSummary
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get response');
			}

			// Handle streaming response
			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			let assistantMessage = '';
			const assistantId = crypto.randomUUID();

			// Add placeholder for assistant response
			messages = [...messages, { id: assistantId, role: 'assistant', content: '' }];

			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				// Parse SSE data
				const lines = chunk.split('\n');
				for (const line of lines) {
					if (line.startsWith('0:')) {
						// Text chunk
						try {
							const text = JSON.parse(line.slice(2));
							assistantMessage += text;
							// Update the last message
							messages = messages.map((m) =>
								m.id === assistantId ? { ...m, content: assistantMessage } : m
							);
						} catch {
							// Ignore parse errors
						}
					}
				}
			}

			// Check if the response contains resume content that we should update
			if (
				assistantMessage.toLowerCase().includes('summary:') ||
				assistantMessage.toLowerCase().includes('experience:') ||
				assistantMessage.toLowerCase().includes("here's your")
			) {
				// Parse any resume content updates
				updateResumeFromResponse(assistantMessage);
			}
		} catch (error) {
			console.error('Chat error:', error);
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again.'
				}
			];
		} finally {
			isLoading = false;
		}
	}

	function updateResumeFromResponse(response: string) {
		// Simple parsing to update resume fields
		// In a real implementation, this would use structured output from the AI
		if (!generatedResume) return;

		// Look for summary updates
		const summaryMatch = response.match(/(?:summary|professional summary)[:\s]*\n?([^]*?)(?:\n\n|$)/i);
		if (summaryMatch && summaryMatch[1].length > 50) {
			generatedResume = {
				...generatedResume,
				summary: summaryMatch[1].trim()
			};
		}
	}
</script>

<svelte:head>
	<title>Resume Builder | HowlerHire</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Resume Builder</h1>
			<p class="text-muted-foreground">Create a tailored resume with AI assistance</p>
		</div>
		{#if generatedResume}
			<Button onclick={() => (sheetOpen = true)}>
				<FileText class="mr-2 h-4 w-4" />
				View Resume
			</Button>
		{/if}
	</div>

	{#if !data.hasProfile}
		<!-- No Profile Warning -->
		<Card class="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
			<CardContent class="flex items-center gap-4 pt-6">
				<AlertCircle class="h-8 w-8 text-amber-500" />
				<div>
					<h3 class="font-semibold">Complete Your Profile First</h3>
					<p class="text-sm text-muted-foreground">
						For the best results, add your work experience and skills to your profile.
					</p>
					<Button variant="link" class="h-auto p-0" href="/dashboard/profile">
						Go to Profile →
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Job Input Section -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Sparkles class="h-5 w-5" />
					{currentJob ? 'Current Job' : 'Enter Job Details'}
				</CardTitle>
				<CardDescription>
					{currentJob
						? `Tailoring resume for ${currentJob.title} at ${currentJob.company}`
						: 'Paste a job URL or description to get started'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if currentJob}
					<div class="space-y-3">
						<div>
							<span class="font-medium">{currentJob.title}</span>
							<span class="text-muted-foreground"> at {currentJob.company}</span>
						</div>
						{#if currentJob.location}
							<p class="text-sm text-muted-foreground">{currentJob.location}</p>
						{/if}
						{#if currentJob.requirements && currentJob.requirements.length > 0}
							<div class="rounded-lg bg-muted/50 p-3">
								<p class="text-xs font-medium uppercase text-muted-foreground">Key Requirements</p>
								<ul class="mt-1 list-inside list-disc text-sm">
									{#each currentJob.requirements.slice(0, 4) as req}
										<li>{req}</li>
									{/each}
								</ul>
							</div>
						{/if}
						<Button variant="outline" size="sm" onclick={() => (currentJob = null)}>
							Change Job
						</Button>
					</div>
				{:else}
					<JobInputForm onJobParsed={handleJobParsed} />
				{/if}
			</CardContent>
		</Card>

		<!-- Chat Section -->
		<Card class="flex min-h-[500px] flex-col">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<MessageSquare class="h-5 w-5" />
					AI Resume Assistant
				</CardTitle>
				<CardDescription>
					Chat to refine your resume content for this specific role
				</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 p-0">
				<div class="h-[400px] border-t">
					<ChatInterface
						{messages}
						{isLoading}
						onSend={handleSendMessage}
					/>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

<!-- Resume Preview Sheet -->
<ResumeSheet
	open={sheetOpen}
	resume={generatedResume}
	onClose={() => (sheetOpen = false)}
/>
