<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import { Badge } from '$components/ui/badge';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Plus, X, Mail, Bell, BellOff } from 'lucide-svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Default email preferences
	const defaultEmailPrefs = {
		jobMatches: true,
		resumeReady: true,
		weeklySummary: true,
		applicationUpdates: true,
		marketingEmails: false
	};

	// Initialize with empty arrays - $effect will populate from data
	let skills = $state<string[]>([]);
	let preferredRoles = $state<string[]>([]);
	let preferredLocations = $state<string[]>([]);
	let newSkill = $state('');
	let newRole = $state('');
	let newLocation = $state('');
	let loading = $state(false);
	let emailPrefsLoading = $state(false);
	let initialized = $state(false);

	// Email preferences state
	let emailPrefs = $state({ ...defaultEmailPrefs });

	$effect(() => {
		// Sync state with server data when it changes
		if (data.profile && !initialized) {
			skills = data.profile.skills || [];
			preferredRoles = data.profile.preferred_roles || [];
			preferredLocations = data.profile.preferred_locations || [];
			// Parse email preferences from profile or use defaults
			const prefs = data.profile.email_preferences;
			if (prefs && typeof prefs === 'object') {
				emailPrefs = {
					jobMatches: typeof prefs.jobMatches === 'boolean' ? prefs.jobMatches : defaultEmailPrefs.jobMatches,
					resumeReady: typeof prefs.resumeReady === 'boolean' ? prefs.resumeReady : defaultEmailPrefs.resumeReady,
					weeklySummary: typeof prefs.weeklySummary === 'boolean' ? prefs.weeklySummary : defaultEmailPrefs.weeklySummary,
					applicationUpdates: typeof prefs.applicationUpdates === 'boolean' ? prefs.applicationUpdates : defaultEmailPrefs.applicationUpdates,
					marketingEmails: typeof prefs.marketingEmails === 'boolean' ? prefs.marketingEmails : defaultEmailPrefs.marketingEmails
				};
			}
			initialized = true;
		}
	});

	function addSkill() {
		if (newSkill && !skills.includes(newSkill)) {
			skills = [...skills, newSkill];
			newSkill = '';
		}
	}

	function removeSkill(skill: string) {
		skills = skills.filter((s) => s !== skill);
	}

	function addRole() {
		if (newRole && !preferredRoles.includes(newRole)) {
			preferredRoles = [...preferredRoles, newRole];
			newRole = '';
		}
	}

	function removeRole(role: string) {
		preferredRoles = preferredRoles.filter((r) => r !== role);
	}

	function addLocation() {
		if (newLocation && !preferredLocations.includes(newLocation)) {
			preferredLocations = [...preferredLocations, newLocation];
			newLocation = '';
		}
	}

	function removeLocation(location: string) {
		preferredLocations = preferredLocations.filter((l) => l !== location);
	}

	$effect(() => {
		if (form?.success) {
			if (form.action === 'emailPreferences') {
				toast.success('Email preferences updated successfully');
			} else {
				toast.success('Profile updated successfully');
			}
		}
		if (form?.error) {
			toast.error(form.error);
		}
	});
</script>

<svelte:head>
	<title>Profile - Resume Pilot</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold">Profile</h1>
		<p class="text-muted-foreground">Manage your professional profile and job preferences</p>
	</div>

	<form
		method="POST"
		action="?/updateProfile"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
		class="space-y-6"
	>
		<!-- Basic Info -->
		<Card>
			<CardHeader>
				<CardTitle>Basic Information</CardTitle>
				<CardDescription>Your personal and professional details</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="fullName">Full Name</Label>
						<Input
							id="fullName"
							name="fullName"
							value={data.profile?.full_name || ''}
							placeholder="John Doe"
						/>
					</div>

					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={data.profile?.email || ''}
							disabled
							class="bg-muted"
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="headline">Professional Headline</Label>
					<Input
						id="headline"
						name="headline"
						value={data.profile?.headline || ''}
						placeholder="Senior Software Engineer | Full-Stack Developer"
					/>
				</div>

				<div class="space-y-2">
					<Label for="summary">Professional Summary</Label>
					<Textarea
						id="summary"
						name="summary"
						rows={4}
						value={data.profile?.summary || ''}
						placeholder="Brief overview of your experience and career goals..."
					/>
				</div>

				<div class="space-y-2">
					<Label for="location">Current Location</Label>
					<Input
						id="location"
						name="location"
						value={data.profile?.location || ''}
						placeholder="San Francisco, CA"
					/>
				</div>
			</CardContent>
		</Card>

		<!-- External Profiles -->
		<Card>
			<CardHeader>
				<CardTitle>External Profiles</CardTitle>
				<CardDescription>Connect your LinkedIn and GitHub for better matching</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-2">
					<Label for="linkedinUrl">LinkedIn Profile URL</Label>
					<Input
						id="linkedinUrl"
						name="linkedinUrl"
						value={data.profile?.linkedin_url || ''}
						placeholder="https://linkedin.com/in/yourprofile"
					/>
				</div>

				<div class="space-y-2">
					<Label for="githubHandle">GitHub Username</Label>
					<Input
						id="githubHandle"
						name="githubHandle"
						value={data.profile?.github_handle || ''}
						placeholder="yourusername"
					/>
				</div>
			</CardContent>
		</Card>

		<!-- Skills -->
		<Card>
			<CardHeader>
				<CardTitle>Skills</CardTitle>
				<CardDescription>Add your technical and professional skills</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<input type="hidden" name="skills" value={JSON.stringify(skills)} />

				<div class="flex flex-wrap gap-2">
					{#each skills as skill}
						<Badge variant="secondary" class="gap-1">
							{skill}
							<button type="button" onclick={() => removeSkill(skill)}>
								<X class="h-3 w-3" />
							</button>
						</Badge>
					{/each}
				</div>

				<div class="flex gap-2">
					<Input
						placeholder="Add a skill..."
						bind:value={newSkill}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
					/>
					<Button type="button" variant="outline" onclick={addSkill}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
			</CardContent>
		</Card>

		<!-- Job Preferences -->
		<Card>
			<CardHeader>
				<CardTitle>Job Preferences</CardTitle>
				<CardDescription>Help us find the right jobs for you</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				<!-- Preferred Roles -->
				<div class="space-y-4">
					<Label>Preferred Job Titles</Label>
					<input type="hidden" name="preferredRoles" value={JSON.stringify(preferredRoles)} />

					<div class="flex flex-wrap gap-2">
						{#each preferredRoles as role}
							<Badge variant="secondary" class="gap-1">
								{role}
								<button type="button" onclick={() => removeRole(role)}>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
					</div>

					<div class="flex gap-2">
						<Input
							placeholder="e.g., Software Engineer, Product Manager..."
							bind:value={newRole}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addRole())}
						/>
						<Button type="button" variant="outline" onclick={addRole}>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				</div>

				<!-- Preferred Locations -->
				<div class="space-y-4">
					<Label>Preferred Locations</Label>
					<input
						type="hidden"
						name="preferredLocations"
						value={JSON.stringify(preferredLocations)}
					/>

					<div class="flex flex-wrap gap-2">
						{#each preferredLocations as location}
							<Badge variant="secondary" class="gap-1">
								{location}
								<button type="button" onclick={() => removeLocation(location)}>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
					</div>

					<div class="flex gap-2">
						<Input
							placeholder="e.g., San Francisco, New York, Remote..."
							bind:value={newLocation}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
						/>
						<Button type="button" variant="outline" onclick={addLocation}>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				</div>

				<!-- Remote Preference -->
				<div class="space-y-2">
					<Label for="remotePreference">Remote Work Preference</Label>
					<select
						id="remotePreference"
						name="remotePreference"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						value={data.profile?.remote_preference || 'hybrid'}
					>
						<option value="remote">Remote Only</option>
						<option value="hybrid">Hybrid</option>
						<option value="onsite">On-site</option>
					</select>
				</div>

				<!-- Salary -->
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="minSalary">Minimum Salary (USD)</Label>
						<Input
							id="minSalary"
							name="minSalary"
							type="number"
							value={data.profile?.min_salary || ''}
							placeholder="80000"
						/>
					</div>
					<div class="space-y-2">
						<Label for="maxSalary">Maximum Salary (USD)</Label>
						<Input
							id="maxSalary"
							name="maxSalary"
							type="number"
							value={data.profile?.max_salary || ''}
							placeholder="150000"
						/>
					</div>
				</div>
			</CardContent>
		</Card>

		<div class="flex justify-end">
			<Button type="submit" disabled={loading}>
				{loading ? 'Saving...' : 'Save Profile'}
			</Button>
		</div>
	</form>

	<!-- Email Notification Preferences -->
	<form
		method="POST"
		action="?/updateEmailPreferences"
		use:enhance={() => {
			emailPrefsLoading = true;
			return async ({ update }) => {
				emailPrefsLoading = false;
				await update();
			};
		}}
	>
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Mail class="h-5 w-5" />
					Email Notifications
				</CardTitle>
				<CardDescription>
					Choose which email notifications you'd like to receive
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				<!-- Job Matches -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Bell class="h-4 w-4 text-muted-foreground" />
							<Label for="jobMatches" class="font-medium">New Job Matches</Label>
						</div>
						<p class="text-sm text-muted-foreground">
							Get notified when we find new jobs matching your profile
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="jobMatches"
							name="jobMatches"
							class="peer sr-only"
							checked={emailPrefs.jobMatches}
							onchange={(e) => emailPrefs.jobMatches = e.currentTarget.checked}
						/>
						<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
					</label>
				</div>

				<!-- Resume Ready -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Bell class="h-4 w-4 text-muted-foreground" />
							<Label for="resumeReady" class="font-medium">Resume Ready</Label>
						</div>
						<p class="text-sm text-muted-foreground">
							Get notified when your tailored resume is ready to download
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="resumeReady"
							name="resumeReady"
							class="peer sr-only"
							checked={emailPrefs.resumeReady}
							onchange={(e) => emailPrefs.resumeReady = e.currentTarget.checked}
						/>
						<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
					</label>
				</div>

				<!-- Weekly Summary -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Bell class="h-4 w-4 text-muted-foreground" />
							<Label for="weeklySummary" class="font-medium">Weekly Summary</Label>
						</div>
						<p class="text-sm text-muted-foreground">
							Receive a weekly digest of your job search activity
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="weeklySummary"
							name="weeklySummary"
							class="peer sr-only"
							checked={emailPrefs.weeklySummary}
							onchange={(e) => emailPrefs.weeklySummary = e.currentTarget.checked}
						/>
						<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
					</label>
				</div>

				<!-- Application Updates -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Bell class="h-4 w-4 text-muted-foreground" />
							<Label for="applicationUpdates" class="font-medium">Application Updates</Label>
						</div>
						<p class="text-sm text-muted-foreground">
							Get notified when your application status changes
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="applicationUpdates"
							name="applicationUpdates"
							class="peer sr-only"
							checked={emailPrefs.applicationUpdates}
							onchange={(e) => emailPrefs.applicationUpdates = e.currentTarget.checked}
						/>
						<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
					</label>
				</div>

				<hr class="my-4" />

				<!-- Marketing Emails -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<BellOff class="h-4 w-4 text-muted-foreground" />
							<Label for="marketingEmails" class="font-medium">Marketing & Tips</Label>
						</div>
						<p class="text-sm text-muted-foreground">
							Receive product updates, career tips, and special offers
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="marketingEmails"
							name="marketingEmails"
							class="peer sr-only"
							checked={emailPrefs.marketingEmails}
							onchange={(e) => emailPrefs.marketingEmails = e.currentTarget.checked}
						/>
						<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
					</label>
				</div>

				<div class="flex justify-end pt-4">
					<Button type="submit" disabled={emailPrefsLoading}>
						{emailPrefsLoading ? 'Saving...' : 'Save Preferences'}
					</Button>
				</div>
			</CardContent>
		</Card>
	</form>
</div>
