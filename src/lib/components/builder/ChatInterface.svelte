<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Textarea } from '$components/ui/textarea';
	import { Send, User, Bot, Loader2 } from 'lucide-svelte';

	interface Message {
		id: string;
		role: 'user' | 'assistant';
		content: string;
	}

	interface Props {
		messages: Message[];
		isLoading: boolean;
		onSend: (message: string) => void;
	}

	let { messages, isLoading, onSend }: Props = $props();

	let inputValue = $state('');
	let messagesContainer: HTMLDivElement | null = $state(null);

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!inputValue.trim() || isLoading) return;

		onSend(inputValue.trim());
		inputValue = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		messages;
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});
</script>

<div class="flex h-full flex-col">
	<!-- Messages Area -->
	<div
		bind:this={messagesContainer}
		class="flex-1 space-y-4 overflow-y-auto p-4"
	>
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center text-center">
				<div class="space-y-2">
					<Bot class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="font-semibold">Ready to help with your resume</h3>
					<p class="text-sm text-muted-foreground">
						Share your experience, and I'll help you craft compelling resume content tailored to the
						job.
					</p>
				</div>
			</div>
		{:else}
			{#each messages as message (message.id)}
				<div
					class="flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}"
				>
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {message.role ===
						'user'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted'}"
					>
						{#if message.role === 'user'}
							<User class="h-4 w-4" />
						{:else}
							<Bot class="h-4 w-4" />
						{/if}
					</div>
					<div
						class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted'}"
					>
						<p class="whitespace-pre-wrap text-sm">{message.content}</p>
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="flex gap-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
						<Bot class="h-4 w-4" />
					</div>
					<div class="max-w-[80%] rounded-lg bg-muted px-4 py-2">
						<Loader2 class="h-4 w-4 animate-spin" />
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Input Area -->
	<div class="border-t p-4">
		<form onsubmit={handleSubmit} class="flex gap-2">
			<Textarea
				bind:value={inputValue}
				placeholder="Describe your experience or ask for suggestions..."
				class="min-h-[60px] resize-none"
				onkeydown={handleKeydown}
				disabled={isLoading}
			/>
			<Button type="submit" size="icon" class="shrink-0" disabled={isLoading || !inputValue.trim()}>
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Send class="h-4 w-4" />
				{/if}
			</Button>
		</form>
		<p class="mt-2 text-xs text-muted-foreground">
			Press Enter to send, Shift+Enter for new line
		</p>
	</div>
</div>
