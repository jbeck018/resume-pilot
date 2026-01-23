<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import {
		Mail,
		Copy,
		Check,
		Clock,
		Lightbulb,
		ChevronDown,
		ChevronUp,
		Send,
		MessageSquare
	} from 'lucide-svelte';
	import {
		generateEmailTemplate,
		getTemplateTypes,
		type EmailTemplateType,
		type TemplateContext,
		type EmailTemplate
	} from '$lib/services/email-templates';

	interface EmailTemplatesProps {
		candidateName: string;
		jobTitle: string;
		companyName: string;
		recruiterName?: string;
		applicationDate?: Date;
	}

	let {
		candidateName,
		jobTitle,
		companyName,
		recruiterName,
		applicationDate
	}: EmailTemplatesProps = $props();

	const templateTypes = getTemplateTypes();
	let selectedType = $state<EmailTemplateType>('follow-up-application');
	let copiedField = $state<'subject' | 'body' | null>(null);
	let showTips = $state(false);

	const context = $derived<TemplateContext>({
		candidateName,
		jobTitle,
		companyName,
		recruiterName,
		applicationDate
	});

	const template = $derived<EmailTemplate>(generateEmailTemplate(selectedType, context));

	async function copyToClipboard(text: string, field: 'subject' | 'body') {
		try {
			await navigator.clipboard.writeText(text);
			copiedField = field;
			setTimeout(() => {
				copiedField = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function openMailClient() {
		const mailtoUrl = `mailto:?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
		window.open(mailtoUrl, '_blank');
	}

	// Group templates by category
	const applicationTemplates = templateTypes.filter((t) =>
		['follow-up-application', 'request-update', 'withdraw-application'].includes(t.type)
	);
	const interviewTemplates = templateTypes.filter((t) =>
		['thank-you-interview', 'thank-you-phone-screen', 'follow-up-interview'].includes(t.type)
	);
	const offerTemplates = templateTypes.filter((t) =>
		['accept-offer', 'decline-offer'].includes(t.type)
	);
	const networkingTemplates = templateTypes.filter((t) =>
		['networking-introduction', 'referral-request'].includes(t.type)
	);
</script>

<div class="space-y-4">
	<!-- Template Type Selection -->
	<div class="space-y-3">
		<div class="flex items-center gap-2 text-sm font-medium">
			<Mail class="h-4 w-4" />
			Select Email Type
		</div>

		<!-- Application Stage -->
		<div>
			<p class="mb-2 text-xs font-medium text-muted-foreground">Application</p>
			<div class="flex flex-wrap gap-2">
				{#each applicationTemplates as t}
					<Button
						variant={selectedType === t.type ? 'default' : 'outline'}
						size="sm"
						class="h-auto py-1.5 text-xs"
						onclick={() => (selectedType = t.type)}
					>
						{t.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- Interview Stage -->
		<div>
			<p class="mb-2 text-xs font-medium text-muted-foreground">Interview</p>
			<div class="flex flex-wrap gap-2">
				{#each interviewTemplates as t}
					<Button
						variant={selectedType === t.type ? 'default' : 'outline'}
						size="sm"
						class="h-auto py-1.5 text-xs"
						onclick={() => (selectedType = t.type)}
					>
						{t.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- Offer Stage -->
		<div>
			<p class="mb-2 text-xs font-medium text-muted-foreground">Offer</p>
			<div class="flex flex-wrap gap-2">
				{#each offerTemplates as t}
					<Button
						variant={selectedType === t.type ? 'default' : 'outline'}
						size="sm"
						class="h-auto py-1.5 text-xs"
						onclick={() => (selectedType = t.type)}
					>
						{t.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- Networking -->
		<div>
			<p class="mb-2 text-xs font-medium text-muted-foreground">Networking</p>
			<div class="flex flex-wrap gap-2">
				{#each networkingTemplates as t}
					<Button
						variant={selectedType === t.type ? 'default' : 'outline'}
						size="sm"
						class="h-auto py-1.5 text-xs"
						onclick={() => (selectedType = t.type)}
					>
						{t.label}
					</Button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Generated Template -->
	<div class="rounded-lg border bg-card">
		<!-- Subject Line -->
		<div class="border-b p-3">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Subject</span>
				<Button
					variant="ghost"
					size="sm"
					class="h-6 px-2 text-xs"
					onclick={() => copyToClipboard(template.subject, 'subject')}
				>
					{#if copiedField === 'subject'}
						<Check class="mr-1 h-3 w-3 text-green-600" />
						Copied!
					{:else}
						<Copy class="mr-1 h-3 w-3" />
						Copy
					{/if}
				</Button>
			</div>
			<p class="text-sm font-medium">{template.subject}</p>
		</div>

		<!-- Email Body -->
		<div class="p-3">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Email Body</span>
				<Button
					variant="ghost"
					size="sm"
					class="h-6 px-2 text-xs"
					onclick={() => copyToClipboard(template.body, 'body')}
				>
					{#if copiedField === 'body'}
						<Check class="mr-1 h-3 w-3 text-green-600" />
						Copied!
					{:else}
						<Copy class="mr-1 h-3 w-3" />
						Copy
					{/if}
				</Button>
			</div>
			<div class="rounded border bg-muted/30 p-3">
				<pre class="whitespace-pre-wrap font-sans text-sm">{template.body}</pre>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2 border-t p-3">
			<Button size="sm" class="flex-1" onclick={openMailClient}>
				<Send class="mr-2 h-4 w-4" />
				Open in Email Client
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => copyToClipboard(`Subject: ${template.subject}\n\n${template.body}`, 'body')}
			>
				<Copy class="mr-2 h-4 w-4" />
				Copy All
			</Button>
		</div>
	</div>

	<!-- Timing & Tips -->
	<div class="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950">
		<!-- Timing -->
		<div class="mb-3 flex items-start gap-2">
			<Clock class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
			<div>
				<p class="text-xs font-medium text-blue-700 dark:text-blue-400">When to Send</p>
				<p class="text-sm text-blue-600 dark:text-blue-300">{template.timing}</p>
			</div>
		</div>

		<!-- Tips Toggle -->
		<Button
			variant="ghost"
			size="sm"
			class="w-full justify-between text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900"
			onclick={() => (showTips = !showTips)}
		>
			<span class="flex items-center gap-2">
				<Lightbulb class="h-4 w-4" />
				Pro Tips ({template.tips.length})
			</span>
			{#if showTips}
				<ChevronUp class="h-4 w-4" />
			{:else}
				<ChevronDown class="h-4 w-4" />
			{/if}
		</Button>

		{#if showTips}
			<ul class="mt-3 space-y-2">
				{#each template.tips as tip}
					<li class="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-300">
						<MessageSquare class="mt-0.5 h-3 w-3 flex-shrink-0" />
						{tip}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Personalization Reminder -->
	{#if template.body.includes('[')}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
			<p class="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
				<Lightbulb class="h-4 w-4" />
				Remember to replace [bracketed text] with your specific details before sending!
			</p>
		</div>
	{/if}
</div>
