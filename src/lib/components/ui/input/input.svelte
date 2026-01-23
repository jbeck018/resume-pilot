<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	type Props = Omit<HTMLInputAttributes, 'value'> & {
		class?: string;
		value?: string;
	};

	let { class: className, value = $bindable(''), ...restProps }: Props = $props();
</script>

<input
	class={cn(
		'border-input bg-transparent file:bg-transparent placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className
	)}
	bind:value
	{...restProps}
/>
