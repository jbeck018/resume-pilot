<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { buttonVariants, type ButtonProps } from './index.js';
	import { cn } from '$lib/utils.js';

	type AnchorProps = ButtonProps & {
		class?: string;
		children?: Snippet;
		href: string;
	} & Omit<HTMLAnchorAttributes, 'class' | 'href'>;

	type ButtonPropsType = ButtonProps & {
		class?: string;
		children?: Snippet;
		href?: never;
	} & Omit<HTMLButtonAttributes, 'class'>;

	type Props = AnchorProps | ButtonPropsType;

	let { class: className, variant, size, children, href, ...restProps }: Props = $props();
</script>

{#if href}
	<a class={cn(buttonVariants({ variant, size }), className)} {href} {...restProps as Omit<HTMLAnchorAttributes, 'class' | 'href'>}>
		{@render children?.()}
	</a>
{:else}
	<button class={cn(buttonVariants({ variant, size }), className)} {...restProps as Omit<HTMLButtonAttributes, 'class'>}>
		{@render children?.()}
	</button>
{/if}
