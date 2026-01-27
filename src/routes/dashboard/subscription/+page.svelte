<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Check, Mail, Bell, Zap } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Initialize email from user data
	const initialEmail = data.user?.email || '';
	let email = $state(initialEmail);
	let submitted = $state(false);
	let submitting = $state(false);

	// Placeholder pricing tiers
	const tiers = [
		{
			name: 'Free',
			price: '$0',
			description: 'Your current plan',
			features: ['5 job matches/week', '5 resume generations/week', 'Basic templates'],
			current: true,
			popular: false
		},
		{
			name: 'Pro',
			price: '$9.99/mo',
			description: 'For active job seekers',
			features: ['Unlimited matches', '25 generations/week', 'All templates', 'ATS optimization'],
			current: false,
			popular: true
		},
		{
			name: 'Premium',
			price: '$19.99/mo',
			description: 'For power users',
			features: ['Everything in Pro', 'Unlimited generations', 'Career coaching'],
			current: false,
			popular: false
		}
	];

	async function handleWaitlistSubmit() {
		if (!email || submitting) return;

		submitting = true;

		try {
			const response = await fetch('/api/waitlist', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email,
					source: 'dashboard-subscription'
				})
			});

			const data = await response.json();

			if (response.ok) {
				submitted = true;
				toast.success(data.message || "You're on the list!");
			} else {
				toast.error(data.error || 'Failed to join waitlist');
			}
		} catch (error) {
			toast.error('Something went wrong. Please try again.');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Subscription - HowlerHire</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold">Subscription</h1>
		<p class="text-muted-foreground">Manage your subscription and billing</p>
	</div>

	<!-- Current Plan -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle class="flex items-center gap-2">
						<Zap class="h-5 w-5" />
						Current Plan
					</CardTitle>
					<CardDescription>You're currently on the Free tier</CardDescription>
				</div>
				<Badge variant="outline">Free</Badge>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-2">
				<div class="flex items-center gap-2 text-sm">
					<Check class="h-4 w-4 text-green-600" />
					<span>5 job matches per week</span>
				</div>
				<div class="flex items-center gap-2 text-sm">
					<Check class="h-4 w-4 text-green-600" />
					<span>5 resume generations per week</span>
				</div>
				<div class="flex items-center gap-2 text-sm">
					<Check class="h-4 w-4 text-green-600" />
					<span>Basic resume templates</span>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Coming Soon Banner -->
	<Card class="border-primary/50 bg-primary/5">
		<CardHeader>
			<div class="flex items-start gap-4">
				<div class="rounded-full bg-primary/10 p-3">
					<Bell class="h-6 w-6 text-primary" />
				</div>
				<div class="flex-1">
					<Badge variant="secondary" class="mb-2">Coming Soon</Badge>
					<CardTitle>Premium Plans Launching Soon</CardTitle>
					<CardDescription class="mt-2">
						We're putting the finishing touches on our Pro and Premium plans. Get notified when
						they're available and be first in line for early-bird pricing.
					</CardDescription>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			{#if submitted}
				<div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
					<div class="flex items-center gap-3">
						<Check class="h-5 w-5 text-green-600 dark:text-green-400" />
						<div>
							<p class="font-medium text-green-900 dark:text-green-100">You're on the waitlist!</p>
							<p class="text-sm text-green-700 dark:text-green-300">
								We'll email you when paid plans are available.
							</p>
						</div>
					</div>
				</div>
			{:else}
				<form onsubmit={(e) => { e.preventDefault(); handleWaitlistSubmit(); }} class="flex gap-2">
					<div class="relative flex-1">
						<Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="email"
							bind:value={email}
							placeholder="Enter your email"
							required
							class="h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
					</div>
					<Button type="submit" disabled={submitting}>
						{submitting ? 'Joining...' : 'Notify Me'}
					</Button>
				</form>
			{/if}
		</CardContent>
	</Card>

	<!-- Plan Comparison -->
	<div>
		<h2 class="mb-4 text-xl font-semibold">Available Plans</h2>
		<div class="grid gap-4 md:grid-cols-3">
			{#each tiers as tier}
				<Card class="relative {tier.popular ? 'border-primary' : ''} {tier.current ? 'bg-muted/50' : ''}">
					{#if tier.popular}
						<div class="absolute -top-3 left-1/2 -translate-x-1/2">
							<Badge variant="default">Most Popular</Badge>
						</div>
					{/if}
					<CardHeader class="pt-6">
						<div class="flex items-center justify-between">
							<CardTitle class="text-lg">{tier.name}</CardTitle>
							{#if tier.current}
								<Badge variant="outline">Current</Badge>
							{/if}
						</div>
						<div class="text-2xl font-bold">{tier.price}</div>
						<CardDescription>{tier.description}</CardDescription>
					</CardHeader>
					<CardContent>
						<ul class="space-y-2">
							{#each tier.features as feature}
								<li class="flex items-center gap-2 text-sm">
									<Check class="h-4 w-4 text-green-600" />
									<span>{feature}</span>
								</li>
							{/each}
						</ul>
						<Button
							class="mt-4 w-full"
							variant={tier.current ? 'outline' : tier.popular ? 'default' : 'secondary'}
							disabled={!tier.current}
						>
							{tier.current ? 'Current Plan' : 'Coming Soon'}
						</Button>
					</CardContent>
				</Card>
			{/each}
		</div>
	</div>

	<!-- View Full Pricing -->
	<div class="text-center">
		<Button variant="link" href="/pricing">View full pricing details</Button>
	</div>
</div>
