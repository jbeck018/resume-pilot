<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Get error details from page store
	let { status, error: pageError } = $derived($page);

	// Determine if we're in development mode
	const isDev = $derived(import.meta.env.DEV || import.meta.env.MODE === 'development');

	// Error message mapping
	const errorMessages: Record<number, { title: string; message: string }> = {
		404: {
			title: 'Page Not Found',
			message: "We couldn't find the page you're looking for. It may have been moved or deleted."
		},
		403: {
			title: 'Access Forbidden',
			message: "You don't have permission to access this resource."
		},
		500: {
			title: 'Server Error',
			message: 'Something went wrong on our end. Our team has been notified and is working on it.'
		},
		503: {
			title: 'Service Unavailable',
			message: 'The service is temporarily unavailable. Please try again in a few moments.'
		}
	};

	// Get error display info
	const errorInfo = $derived(
		errorMessages[status] || {
			title: 'Unexpected Error',
			message: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
		}
	);

	// Handle go back action
	function handleGoBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}

	// Handle try again action
	function handleTryAgain() {
		window.location.reload();
	}

	// Log error on mount for debugging (Sentry is already integrated server-side via hooks.server.ts)
	onMount(() => {
		if (pageError) {
			console.error(`[Error ${status}]`, pageError.message || pageError);
		}
	});
</script>

<svelte:head>
	<title>{status} - {errorInfo.title}</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
	<div class="max-w-2xl w-full text-center space-y-8">
		<!-- Error Code -->
		<div class="space-y-2">
			<h1 class="text-9xl font-bold text-primary/20 select-none">
				{status}
			</h1>
			<h2 class="text-3xl font-semibold text-foreground">
				{errorInfo.title}
			</h2>
			<p class="text-lg text-muted-foreground max-w-md mx-auto">
				{errorInfo.message}
			</p>
		</div>

		<!-- Development Error Details -->
		{#if isDev && pageError}
			<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-left">
				<h3 class="text-sm font-semibold text-destructive mb-2">
					Development Error Details
				</h3>
				<div class="space-y-2">
					<div class="text-sm">
						<span class="font-medium text-foreground">Message:</span>
						<pre class="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto text-foreground">
{pageError.message || 'No error message available'}</pre>
					</div>
					{#if 'stack' in pageError && pageError.stack}
						<div class="text-sm">
							<span class="font-medium text-foreground">Stack Trace:</span>
							<pre class="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto text-foreground">
{pageError.stack}</pre>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
			<button
				onclick={handleGoBack}
				class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-w-[140px]"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m12 19-7-7 7-7" />
					<path d="M19 12H5" />
				</svg>
				Go Back
			</button>

			<button
				onclick={handleTryAgain}
				class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 min-w-[140px]"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
					<path d="M3 3v5h5" />
					<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
					<path d="M16 16h5v5" />
				</svg>
				Try Again
			</button>
		</div>

		<!-- Support Link -->
		{#if !isDev && status >= 500}
			<div class="text-sm text-muted-foreground">
				Need help?
				<a
					href="mailto:support@howlerhire.com"
					class="text-primary hover:underline font-medium"
				>
					Contact Support
				</a>
			</div>
		{/if}

		<!-- Additional Resources for 404 -->
		{#if status === 404}
			<div class="pt-4 border-t border-border">
				<p class="text-sm text-muted-foreground mb-3">
					You might want to try:
				</p>
				<div class="flex flex-wrap gap-2 justify-center">
					<a
						href="/"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Home
					</a>
					<a
						href="/dashboard"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Dashboard
					</a>
					<a
						href="/pricing"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Pricing
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Ensure error page uses system colors properly */
	:global(body) {
		background-color: hsl(var(--background));
	}
</style>
