<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	type Props = Omit<HTMLTextareaAttributes, 'value'> & {
		class?: string;
		value?: string;
	};

	let { class: className, value = $bindable(''), ...restProps }: Props = $props();
</script>

<textarea
	class={cn(
		'border-input bg-transparent placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className
	)}
	bind:value
	{...restProps}
></textarea>
