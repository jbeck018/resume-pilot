<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Briefcase, AlertCircle, CheckCircle, Shield } from 'lucide-svelte';

	let { data, form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Accept Invitation - HowlerHire</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center p-4">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
				<Briefcase class="h-6 w-6 text-primary-foreground" />
			</div>
			<CardTitle class="text-2xl">You're Invited!</CardTitle>
			<CardDescription>Create your HowlerHire account</CardDescription>
		</CardHeader>
		<CardContent>
			{#if !data.valid}
				<!-- Invalid or expired invitation -->
				<div class="space-y-4 text-center">
					<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle class="h-8 w-8 text-destructive" />
					</div>
					<div>
						<h3 class="font-semibold">Invalid Invitation</h3>
						<p class="text-sm text-muted-foreground">{data.error}</p>
					</div>
					<div class="pt-4">
						<a href="/auth/signup" class="text-primary hover:underline">
							Request a new invitation or sign up
						</a>
					</div>
				</div>
			{:else if form?.success}
				<!-- Success message -->
				<div class="space-y-4 text-center">
					<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
						<CheckCircle class="h-8 w-8 text-green-500" />
					</div>
					<div>
						<h3 class="font-semibold">Account Created!</h3>
						<p class="text-sm text-muted-foreground">
							Check your email to confirm your account, then you can sign in.
						</p>
					</div>
					<div class="pt-4">
						<a href="/auth/login">
							<Button class="w-full">Go to Login</Button>
						</a>
					</div>
				</div>
			{:else}
				<!-- Invitation details and signup form -->
				<div class="mb-6 rounded-lg border bg-muted/50 p-4">
					<div class="space-y-2 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Email:</span>
							<span class="font-medium">{data.invitation?.email}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Role:</span>
							<Badge variant={data.invitation?.role === 'admin' ? 'default' : 'secondary'}>
								{#if data.invitation?.role === 'admin'}
									<Shield class="mr-1 h-3 w-3" />
								{/if}
								{data.invitation?.role === 'admin' ? 'Admin' : 'User'}
							</Badge>
						</div>
						{#if data.invitation?.invitedBy}
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">Invited by:</span>
								<span class="font-medium">{data.invitation.invitedBy}</span>
							</div>
						{/if}
					</div>
				</div>

				<form
					method="POST"
					action="?/acceptInvite"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
					class="space-y-4"
				>
					{#if form?.error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{form.error}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="password">Create Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Create a secure password"
							required
							autocomplete="new-password"
							minlength={8}
						/>
						<p class="text-xs text-muted-foreground">Must be at least 8 characters</p>
					</div>

					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? 'Creating account...' : 'Create Account'}
					</Button>
				</form>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">Or continue with</span>
					</div>
				</div>

				<form method="POST" action="?/oauth" class="space-y-2">
					<input type="hidden" name="provider" value="google" />
					<Button type="submit" variant="outline" class="w-full">
						<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="currentColor"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="currentColor"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="currentColor"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						Google
					</Button>
				</form>

				<p class="mt-6 text-center text-sm text-muted-foreground">
					Already have an account?
					<a href="/auth/login" class="text-primary hover:underline">Sign in</a>
				</p>
			{/if}
		</CardContent>
	</Card>
</div>
