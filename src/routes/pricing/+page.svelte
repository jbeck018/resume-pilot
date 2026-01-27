<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Check, Briefcase, Mail, ArrowLeft } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let email = $state('');
	let submitted = $state(false);
	let submitting = $state(false);

	// Placeholder pricing tiers to show what's coming
	const tiers = [
		{
			name: 'Free',
			price: '$0',
			description: 'Perfect for getting started',
			features: [
				'5 job matches per week',
				'5 resume generations per week',
				'Basic resume templates',
				'Job tracking'
			],
			badge: null,
			popular: false
		},
		{
			name: 'Pro',
			price: '$9.99',
			period: '/month',
			description: 'For active job seekers',
			features: [
				'Unlimited job matches',
				'25 resume generations per week',
				'All resume templates',
				'Cover letter generation',
				'ATS optimization',
				'Priority support'
			],
			badge: 'Most Popular',
			popular: true
		},
		{
			name: 'Premium',
			price: '$19.99',
			period: '/month',
			description: 'For power users',
			features: [
				'Everything in Pro',
				'Unlimited resume generations',
				'LinkedIn optimization',
				'Interview prep materials',
				'Salary negotiation tips',
				'1-on-1 career coaching'
			],
			badge: null,
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
					source: 'pricing'
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
	<title>Pricing - HowlerHire</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b">
		<div class="container flex h-16 items-center justify-between">
			<div class="flex items-center gap-2">
				<a href="/" class="flex items-center gap-2">
					<Briefcase class="h-6 w-6" />
					<span class="text-xl font-bold">HowlerHire</span>
				</a>
			</div>
			<nav class="flex items-center gap-4">
				<Button variant="ghost" href="/">
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back to Home
				</Button>
			</nav>
		</div>
	</header>

	<main class="container py-16">
		<!-- Coming Soon Banner -->
		<div class="mx-auto max-w-3xl text-center">
			<Badge variant="secondary" class="mb-4 px-4 py-2 text-sm">Coming Soon</Badge>
			<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Pricing Plans</h1>
			<p class="mt-4 text-lg text-muted-foreground">
				We're finalizing our pricing plans. Join the waitlist to be notified when we launch and get
				early access.
			</p>

			<!-- Waitlist Signup -->
			<div class="mx-auto mt-8 max-w-md">
				{#if submitted}
					<div class="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
						<Check class="mx-auto h-12 w-12 text-green-600 dark:text-green-400" />
						<h3 class="mt-4 text-lg font-semibold text-green-900 dark:text-green-100">
							You're on the list!
						</h3>
						<p class="mt-2 text-green-700 dark:text-green-300">
							We'll notify you when pricing is available. Thank you for your interest!
						</p>
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
							{submitting ? 'Joining...' : 'Join Waitlist'}
						</Button>
					</form>
				{/if}
			</div>
		</div>

		<!-- Pricing Tiers Preview -->
		<div class="mx-auto mt-16 max-w-6xl">
			<h2 class="mb-8 text-center text-2xl font-semibold">What to Expect</h2>
			<div class="grid gap-6 md:grid-cols-3">
				{#each tiers as tier}
					<Card class="relative {tier.popular ? 'border-primary shadow-lg' : ''}">
						{#if tier.badge}
							<div class="absolute -top-3 left-1/2 -translate-x-1/2">
								<Badge variant="default">{tier.badge}</Badge>
							</div>
						{/if}
						<CardHeader class="pt-8">
							<CardTitle>{tier.name}</CardTitle>
							<CardDescription>{tier.description}</CardDescription>
							<div class="mt-4">
								<span class="text-4xl font-bold">{tier.price}</span>
								{#if tier.period}
									<span class="text-muted-foreground">{tier.period}</span>
								{/if}
							</div>
						</CardHeader>
						<CardContent>
							<ul class="space-y-3">
								{#each tier.features as feature}
									<li class="flex items-start gap-2">
										<Check class="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
										<span class="text-sm">{feature}</span>
									</li>
								{/each}
							</ul>
							<Button
								class="mt-6 w-full"
								variant={tier.popular ? 'default' : 'outline'}
								disabled
							>
								Coming Soon
							</Button>
						</CardContent>
					</Card>
				{/each}
			</div>
		</div>

		<!-- FAQ Section -->
		<div class="mx-auto mt-16 max-w-2xl">
			<h2 class="mb-8 text-center text-2xl font-semibold">Frequently Asked Questions</h2>
			<div class="space-y-6">
				<div>
					<h3 class="font-semibold">When will pricing be available?</h3>
					<p class="mt-2 text-muted-foreground">
						We're working hard to finalize our pricing plans. Join the waitlist to be the first to
						know when we launch.
					</p>
				</div>
				<div>
					<h3 class="font-semibold">Will there be a free tier?</h3>
					<p class="mt-2 text-muted-foreground">
						Yes! We'll always have a free tier so you can try HowlerHire before committing to a
						paid plan.
					</p>
				</div>
				<div>
					<h3 class="font-semibold">Can I use HowlerHire now?</h3>
					<p class="mt-2 text-muted-foreground">
						Absolutely! You can sign up and use HowlerHire with our free tier limits today. No
						credit card required.
					</p>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t py-8">
		<div class="container text-center text-sm text-muted-foreground">
			<p>&copy; 2024 HowlerHire. Built with AI.</p>
		</div>
	</footer>
</div>
