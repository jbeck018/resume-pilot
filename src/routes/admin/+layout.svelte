<script lang="ts">
	import { Button } from '$components/ui/button';
	import {
		Briefcase,
		Home,
		LogOut,
		Menu,
		Moon,
		Shield,
		Sun,
		UserPlus,
		Users,
		X
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { toggleMode, mode } from 'mode-watcher';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ href: '/admin', label: 'Overview', icon: Home },
		{ href: '/admin/invitations', label: 'Invitations', icon: UserPlus },
		{ href: '/admin/users', label: 'Users', icon: Users }
	];

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	// Close menu when route changes
	$effect(() => {
		$page.url.pathname;
		mobileMenuOpen = false;
	});
</script>

<div class="flex min-h-screen">
	<!-- Mobile Header -->
	<header
		class="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden"
	>
		<div class="flex items-center gap-2">
			<Shield class="h-5 w-5 text-orange-500" />
			<span class="font-bold">Admin Panel</span>
		</div>
		<Button variant="ghost" size="icon" onclick={() => (mobileMenuOpen = !mobileMenuOpen)}>
			{#if mobileMenuOpen}
				<X class="h-5 w-5" />
			{:else}
				<Menu class="h-5 w-5" />
			{/if}
		</Button>
	</header>

	<!-- Mobile Menu Overlay -->
	{#if mobileMenuOpen}
		<div
			class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
			onclick={closeMobileMenu}
			onkeydown={(e) => e.key === 'Escape' && closeMobileMenu()}
			role="button"
			tabindex="-1"
		></div>
	{/if}

	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-300 md:translate-x-0 {mobileMenuOpen
			? 'translate-x-0'
			: '-translate-x-full'} md:block"
	>
		<div class="flex h-16 items-center gap-2 border-b px-6 max-md:hidden">
			<Shield class="h-6 w-6 text-orange-500" />
			<span class="text-lg font-bold">Admin Panel</span>
		</div>

		<!-- Mobile close button area -->
		<div class="flex h-14 items-center justify-end px-4 md:hidden">
			<Button variant="ghost" size="icon" onclick={closeMobileMenu}>
				<X class="h-5 w-5" />
			</Button>
		</div>

		{#if data.isRootAdmin}
			<div class="mx-4 mb-2 rounded-md bg-orange-500/10 px-3 py-2 text-xs text-orange-600">
				Root Admin
			</div>
		{/if}

		<nav class="flex flex-col gap-1 p-4">
			{#each navItems as item}
				{@const isActive =
					$page.url.pathname === item.href ||
					($page.url.pathname.startsWith(item.href) && item.href !== '/admin')}
				<a
					href={item.href}
					onclick={closeMobileMenu}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<item.icon class="h-4 w-4" />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="absolute bottom-0 left-0 right-0 border-t p-4">
			<a
				href="/dashboard"
				class="mb-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
			>
				<Briefcase class="h-4 w-4" />
				Back to Dashboard
			</a>

			<div class="mb-4 flex items-center justify-between">
				<span class="text-sm text-muted-foreground">Theme</span>
				<Button variant="ghost" size="icon" onclick={toggleMode}>
					{#if $mode === 'dark'}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4" />
					{/if}
				</Button>
			</div>

			<form method="POST" action="/auth/logout">
				<Button variant="outline" class="w-full justify-start" type="submit">
					<LogOut class="mr-2 h-4 w-4" />
					Log out
				</Button>
			</form>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 pt-14 md:ml-64 md:pt-0">
		<div class="container py-6 md:py-8">
			{@render children()}
		</div>
	</main>
</div>
