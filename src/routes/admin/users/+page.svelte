<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import {
		Users,
		Shield,
		User,
		Search
	} from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let searchQuery = $state('');
	let roleFilter = $state<'all' | 'user' | 'admin' | 'root_admin'>('all');

	const filteredUsers = $derived(
		data.users.filter((user) => {
			const matchesSearch =
				searchQuery === '' ||
				user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				user.fullName?.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesRole =
				roleFilter === 'all' ||
				user.role === roleFilter ||
				(roleFilter === 'admin' && (user.role === 'admin' || user.role === 'root_admin'));

			return matchesSearch && matchesRole;
		})
	);

	async function changeUserRole(userId: string, newRole: 'user' | 'admin') {
		if (!data.isRootAdmin) {
			toast.error('Only root admin can change user roles');
			return;
		}

		if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
			return;
		}

		try {
			const response = await fetch('/api/admin/users/role', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, role: newRole })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to update role');
			}

			await invalidateAll();
			toast.success('User role updated');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update role');
		}
	}

	function formatDate(date: string | Date) {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getRoleBadge(role: string) {
		switch (role) {
			case 'root_admin':
				return { variant: 'destructive' as const, label: 'Root Admin', icon: Shield };
			case 'admin':
				return { variant: 'default' as const, label: 'Admin', icon: Shield };
			default:
				return { variant: 'secondary' as const, label: 'User', icon: User };
		}
	}
</script>

<svelte:head>
	<title>Users - Admin - HowlerHire</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">User Management</h1>
		<p class="text-muted-foreground">View and manage user accounts.</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Total Users</CardTitle>
				<Users class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.total}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Admin Users</CardTitle>
				<Shield class="h-4 w-4 text-orange-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.admins}</div>
			</CardContent>
		</Card>
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Regular Users</CardTitle>
				<User class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{data.stats.regular}</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-4 sm:flex-row">
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				placeholder="Search by email or name..."
				class="pl-9"
				bind:value={searchQuery}
			/>
		</div>
		<select
			class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-40"
			bind:value={roleFilter}
		>
			<option value="all">All Roles</option>
			<option value="user">Users</option>
			<option value="admin">Admins</option>
		</select>
	</div>

	<!-- Users List -->
	<Card>
		<CardHeader>
			<CardTitle>All Users</CardTitle>
			<CardDescription>
				{filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if filteredUsers.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<Users class="mb-4 h-12 w-12 text-muted-foreground" />
					<p class="text-muted-foreground">No users found</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each filteredUsers as user}
						{@const roleInfo = getRoleBadge(user.role)}
						{@const isCurrentUser = user.userId === data.currentUserId}
						<div
							class="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex-1 space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">{user.email}</span>
									{#if isCurrentUser}
										<Badge variant="outline" class="text-xs">You</Badge>
									{/if}
								</div>
								{#if user.fullName}
									<p class="text-sm text-muted-foreground">{user.fullName}</p>
								{/if}
								<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
									<Badge variant={roleInfo.variant}>
										{#if roleInfo.icon === Shield}
											<Shield class="mr-1 h-3 w-3" />
										{:else}
											<User class="mr-1 h-3 w-3" />
										{/if}
										{roleInfo.label}
									</Badge>
									<span>Joined {formatDate(user.createdAt)}</span>
								</div>
							</div>

							{#if data.isRootAdmin && !isCurrentUser && user.role !== 'root_admin'}
								<div class="flex gap-2">
									{#if user.role === 'user'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => changeUserRole(user.userId, 'admin')}
										>
											<Shield class="mr-1 h-4 w-4" />
											Make Admin
										</Button>
									{:else if user.role === 'admin'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => changeUserRole(user.userId, 'user')}
										>
											<User class="mr-1 h-4 w-4" />
											Remove Admin
										</Button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	{#if !data.isRootAdmin}
		<p class="text-center text-sm text-muted-foreground">
			Note: Only root admin can change user roles.
		</p>
	{/if}
</div>
