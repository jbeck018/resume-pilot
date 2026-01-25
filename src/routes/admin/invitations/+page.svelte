<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Badge } from '$components/ui/badge';
	import {
		Mail,
		UserPlus,
		Clock,
		CheckCircle,
		XCircle,
		Copy,
		RefreshCw,
		Trash2,
		AlertCircle,
		Shield
	} from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	// Form state
	let email = $state('');
	let role = $state<'user' | 'admin'>('user');
	let loading = $state(false);

	// Dialog state
	let newInvitationUrl = $state('');
	let dialogOpen = $state(false);

	async function createInvitation() {
		if (!email) {
			toast.error('Please enter an email address');
			return;
		}

		loading = true;
		try {
			const response = await fetch('/api/admin/invitations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, role })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to create invitation');
			}

			newInvitationUrl = result.invitation.invitationUrl;
			dialogOpen = true;
			email = '';
			role = 'user';
			await invalidateAll();
			toast.success('Invitation created successfully');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to create invitation');
		} finally {
			loading = false;
		}
	}

	async function revokeInvitation(id: string) {
		if (!confirm('Are you sure you want to revoke this invitation?')) {
			return;
		}

		try {
			const response = await fetch('/api/admin/invitations', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to revoke invitation');
			}

			await invalidateAll();
			toast.success('Invitation revoked');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to revoke invitation');
		}
	}

	async function resendInvitation(id: string) {
		try {
			const response = await fetch('/api/admin/invitations', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to resend invitation');
			}

			newInvitationUrl = result.invitation.invitationUrl;
			dialogOpen = true;
			await invalidateAll();
			toast.success('Invitation refreshed with new link');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to resend invitation');
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toast.success('Link copied to clipboard');
	}

	function formatDate(date: string | Date) {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getStatusBadge(status: string, isExpired: boolean) {
		if (isExpired) {
			return { variant: 'destructive' as const, label: 'Expired' };
		}
		switch (status) {
			case 'pending':
				return { variant: 'secondary' as const, label: 'Pending' };
			case 'accepted':
				return { variant: 'default' as const, label: 'Accepted' };
			case 'revoked':
				return { variant: 'outline' as const, label: 'Revoked' };
			default:
				return { variant: 'secondary' as const, label: status };
		}
	}

	function getStatusIcon(status: string, isExpired: boolean) {
		if (isExpired) return AlertCircle;
		switch (status) {
			case 'pending':
				return Clock;
			case 'accepted':
				return CheckCircle;
			case 'revoked':
				return XCircle;
			default:
				return Clock;
		}
	}
</script>

<svelte:head>
	<title>Invitations - Admin - Resume Pilot</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">User Invitations</h1>
		<p class="text-muted-foreground">Invite new users to join the platform.</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Pending</CardTitle>
				<Mail class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.pending}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Accepted</CardTitle>
				<CheckCircle class="h-4 w-4 text-green-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.accepted}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Expired</CardTitle>
				<AlertCircle class="h-4 w-4 text-orange-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.expired}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Admin Users</CardTitle>
				<Shield class="h-4 w-4 text-orange-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.adminCount}</div>
			</CardContent>
		</Card>
	</div>

	<!-- Create Invitation Form -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<UserPlus class="h-5 w-5" />
				Invite New User
			</CardTitle>
			<CardDescription>Send an invitation to a new user via email link.</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end">
				<div class="flex-1 space-y-2">
					<Label for="email">Email Address</Label>
					<Input id="email" type="email" placeholder="user@example.com" bind:value={email} />
				</div>
				<div class="w-full space-y-2 sm:w-40">
					<Label for="role">Role</Label>
					<select
						id="role"
						class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						bind:value={role}
					>
						<option value="user">User</option>
						{#if data.isRootAdmin}
							<option value="admin">Admin</option>
						{/if}
					</select>
				</div>
				<Button onclick={createInvitation} disabled={loading || !email}>
					{#if loading}
						<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
						Creating...
					{:else}
						<UserPlus class="mr-2 h-4 w-4" />
						Send Invitation
					{/if}
				</Button>
			</div>

			{#if !data.isRootAdmin}
				<p class="mt-4 text-sm text-muted-foreground">
					Note: Only root admin can invite admin users. You can invite regular users.
				</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Invitations List -->
	<Card>
		<CardHeader>
			<CardTitle>All Invitations</CardTitle>
			<CardDescription>Manage pending and past invitations.</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.invitations.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<Mail class="mb-4 h-12 w-12 text-muted-foreground" />
					<p class="text-muted-foreground">No invitations yet</p>
					<p class="text-sm text-muted-foreground">Create your first invitation above.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.invitations as invitation}
						{@const statusInfo = getStatusBadge(invitation.status, invitation.isExpired)}
						{@const StatusIcon = getStatusIcon(invitation.status, invitation.isExpired)}
						<div
							class="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex-1 space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">{invitation.email}</span>
									{#if invitation.role === 'admin'}
										<Badge variant="outline" class="text-orange-600">
											<Shield class="mr-1 h-3 w-3" />
											Admin
										</Badge>
									{/if}
								</div>
								<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
									<Badge variant={statusInfo.variant}>
										<StatusIcon class="mr-1 h-3 w-3" />
										{statusInfo.label}
									</Badge>
									<span>Invited {formatDate(invitation.createdAt)}</span>
									{#if invitation.status === 'pending'}
										<span>
											{invitation.isExpired ? 'Expired' : 'Expires'} {formatDate(invitation.expiresAt)}
										</span>
									{/if}
									{#if invitation.status === 'accepted' && invitation.acceptedAt}
										<span>Accepted {formatDate(invitation.acceptedAt)}</span>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									Invited by: {invitation.invitedByEmail || 'Unknown'}
								</div>
							</div>

							{#if invitation.status === 'pending'}
								<div class="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											copyToClipboard(`${window.location.origin}/invite/${invitation.token}`)}
									>
										<Copy class="mr-1 h-4 w-4" />
										Copy Link
									</Button>
									<Button variant="outline" size="sm" onclick={() => resendInvitation(invitation.id)}>
										<RefreshCw class="mr-1 h-4 w-4" />
										Refresh
									</Button>
									<Button
										variant="destructive"
										size="sm"
										onclick={() => revokeInvitation(invitation.id)}
									>
										<Trash2 class="mr-1 h-4 w-4" />
										Revoke
									</Button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<!-- Success Dialog with Copy Link -->
{#if dialogOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
		onclick={() => (dialogOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (dialogOpen = false)}
		role="dialog"
		tabindex="-1"
	>
		<div
			class="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
		>
			<h2 class="mb-2 text-lg font-semibold">Invitation Created</h2>
			<p class="mb-4 text-sm text-muted-foreground">
				Share this link with the invitee. It will expire in 7 days.
			</p>
			<div class="flex items-center space-x-2">
				<Input value={newInvitationUrl} readonly class="flex-1" />
				<Button size="sm" class="px-3" onclick={() => copyToClipboard(newInvitationUrl)}>
					<Copy class="h-4 w-4" />
				</Button>
			</div>
			<div class="mt-4 flex justify-end">
				<Button variant="secondary" onclick={() => (dialogOpen = false)}>Done</Button>
			</div>
		</div>
	</div>
{/if}
