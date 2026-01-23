<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { badgeVariants, type BadgeProps } from './index.js';
	import { cn } from '$lib/utils.js';

	type Props = BadgeProps &
		HTMLAttributes<HTMLDivElement> & {
			class?: string;
			children?: Snippet;
		};

	let { class: className, variant, children, ...restProps }: Props = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
