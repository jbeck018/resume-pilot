<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Get error details from page store
	let { status, error: pageError } = $derived($page);

	// Determine if we're in development mode
	const isDev = $derived(import.meta.env.DEV || import.meta.env.MODE === 'development');

	// Dashboard-specific error messages
	const errorMessages: Record<number, { title: string; message: string }> = {
		401: {
			title: 'Authentication Required',
			message: 'Please log in to access your dashboard.'
		},
		403: {
			title: 'Access Denied',
			message: "You don't have permission to access this dashboard feature. Check your subscription plan or contact support."
		},
		404: {
			title: 'Dashboard Feature Not Found',
			message: "The dashboard page or feature you're looking for doesn't exist."
		},
		429: {
			title: 'Rate Limit Exceeded',
			message: "You've exceeded your usage limit. Please upgrade your plan or wait for your limit to reset."
		},
		500: {
			title: 'Dashboard Error',
			message: 'Something went wrong while loading your dashboard. Our team has been notified.'
		},
		503: {
			title: 'Service Temporarily Unavailable',
			message: 'Dashboard services are temporarily unavailable. Please try again shortly.'
		}
	};

	// Get error display info
	const errorInfo = $derived(
		errorMessages[status] || {
			title: 'Dashboard Error',
			message: 'An unexpected error occurred in the dashboard. Please try again or contact support.'
		}
	);

	// Handle go back action
	function handleGoBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/dashboard');
		}
	}

	// Handle try again action
	function handleTryAgain() {
		window.location.reload();
	}

	// Handle return to dashboard
	function handleReturnToDashboard() {
		goto('/dashboard');
	}

	// Log error on mount for debugging (Sentry is already integrated server-side via hooks.server.ts)
	onMount(() => {
		if (pageError) {
			console.error(`[Dashboard Error ${status}]`, pageError.message || pageError);
		}
	});
</script>

<svelte:head>
	<title>{status} - {errorInfo.title} | Dashboard</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
	<div class="max-w-2xl w-full text-center space-y-8">
		<!-- Dashboard Icon & Error Code -->
		<div class="space-y-4">
			<div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="40"
					height="40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-primary"
				>
					<rect width="7" height="9" x="3" y="3" rx="1" />
					<rect width="7" height="5" x="14" y="3" rx="1" />
					<rect width="7" height="9" x="14" y="12" rx="1" />
					<rect width="7" height="5" x="3" y="16" rx="1" />
				</svg>
			</div>
			<h1 class="text-8xl font-bold text-primary/20 select-none">
				{status}
			</h1>
			<h2 class="text-3xl font-semibold text-foreground">
				{errorInfo.title}
			</h2>
			<p class="text-lg text-muted-foreground max-w-md mx-auto">
				{errorInfo.message}
			</p>
		</div>

		<!-- Special messaging for specific errors -->
		{#if status === 429}
			<div class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
				<p class="text-amber-700 dark:text-amber-300">
					You can view your usage limits and upgrade your plan from the
					<a href="/dashboard/subscription" class="font-medium underline hover:no-underline">
						Subscription Settings
					</a>
				</p>
			</div>
		{/if}

		{#if status === 403}
			<div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
				<p class="text-blue-700 dark:text-blue-300">
					This feature may require a higher subscription tier. Check
					<a href="/pricing" class="font-medium underline hover:no-underline">
						our pricing plans
					</a>
					to unlock more features.
				</p>
			</div>
		{/if}

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
					{#if 'code' in pageError && pageError.code}
						<div class="text-sm">
							<span class="font-medium text-foreground">Error Code:</span>
							<pre class="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto text-foreground">
{pageError.code}</pre>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
			<button
				onclick={handleReturnToDashboard}
				class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-w-[180px]"
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
					<rect width="7" height="9" x="3" y="3" rx="1" />
					<rect width="7" height="5" x="14" y="3" rx="1" />
					<rect width="7" height="9" x="14" y="12" rx="1" />
					<rect width="7" height="5" x="3" y="16" rx="1" />
				</svg>
				Return to Dashboard
			</button>

			<button
				onclick={handleGoBack}
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

		<!-- Support & Quick Links -->
		<div class="pt-4 border-t border-border space-y-4">
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

			<!-- Quick Dashboard Links -->
			<div>
				<p class="text-sm text-muted-foreground mb-3">
					Quick Dashboard Links:
				</p>
				<div class="flex flex-wrap gap-2 justify-center">
					<a
						href="/dashboard"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Dashboard Home
					</a>
					<a
						href="/dashboard/resumes"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						My Resumes
					</a>
					<a
						href="/dashboard/jobs"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Job Applications
					</a>
					<a
						href="/dashboard/profile"
						class="inline-flex items-center px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
					>
						Profile
					</a>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Ensure error page uses system colors properly */
	:global(body) {
		background-color: hsl(var(--background));
	}
</style>
