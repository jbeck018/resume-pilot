<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import { Badge } from '$components/ui/badge';
	import { enhance } from '$app/forms';
	import { Upload, Link2, Briefcase, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let currentStep = $state(1);
	let loading = $state(false);
	let fileName = $state<string>('');
	let portfolioUrls = $state<string[]>([]);
	let newPortfolioUrl = $state('');

	const TOTAL_STEPS = 4;

	const steps = [
		{ number: 1, title: 'Upload Resume', icon: Upload },
		{ number: 2, title: 'Add Profiles', icon: Link2 },
		{ number: 3, title: 'Ideal Job', icon: Briefcase },
		{ number: 4, title: 'Confirm', icon: CheckCircle2 }
	];

	const exampleIdealJob = `I'm looking for a Senior Software Engineer role at a mid-size tech company (50-500 employees) focused on developer tools or AI/ML. I prefer remote-first companies with async communication. Ideally $150-180k base with equity. Most interested in roles involving TypeScript, React, and system design.`;

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			fileName = input.files[0].name;
		}
	}

	function addPortfolioUrl() {
		if (newPortfolioUrl && !portfolioUrls.includes(newPortfolioUrl)) {
			portfolioUrls = [...portfolioUrls, newPortfolioUrl];
			newPortfolioUrl = '';
		}
	}

	function removePortfolioUrl(url: string) {
		portfolioUrls = portfolioUrls.filter(u => u !== url);
	}

	$effect(() => {
		if (form?.success) {
			loading = false;
			// Move to next step if form submission was successful
			if (form.step && currentStep < TOTAL_STEPS) {
				currentStep = form.step + 1;
			}
		}
		if (form?.error) {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Get Started - Resume Pilot</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12">
	<div class="container max-w-4xl mx-auto px-4">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold mb-2">Welcome to Resume Pilot</h1>
			<p class="text-muted-foreground text-lg">Let's get your job hunt on autopilot in just a few steps</p>
		</div>

		<!-- Progress Steps -->
		<div class="mb-8">
			<div class="flex items-center justify-between max-w-2xl mx-auto">
				{#each steps as step, index}
					<div class="flex flex-col items-center flex-1">
						<div class="flex items-center w-full">
							<div class={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
								currentStep > step.number
									? 'bg-primary border-primary text-primary-foreground'
									: currentStep === step.number
										? 'border-primary text-primary'
										: 'border-muted-foreground/30 text-muted-foreground'
							}`}>
								{#if currentStep > step.number}
									<CheckCircle2 class="w-5 h-5" />
								{:else}
									{@const StepIcon = step.icon}
									<StepIcon class="w-5 h-5" />
								{/if}
							</div>
							{#if index < steps.length - 1}
								<div class={`flex-1 h-0.5 mx-2 ${currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground/30'}`}></div>
							{/if}
						</div>
						<span class={`text-xs mt-2 text-center ${currentStep >= step.number ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
							{step.title}
						</span>
					</div>
				{/each}
			</div>
		</div>

		{#if form?.error}
			<div class="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
				{form.error}
			</div>
		{/if}

		<!-- Step Content -->
		{#if currentStep === 1}
			<!-- Step 1: Upload Resume -->
			<Card>
				<CardHeader>
					<CardTitle>Upload Your Resume</CardTitle>
					<CardDescription>Upload at least one resume to get started. We support PDF and DOCX formats.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						method="POST"
						action="?/uploadResume"
						enctype="multipart/form-data"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<div class="space-y-6">
							<div class="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
								<input
									type="file"
									name="resume"
									id="resume"
									accept=".pdf,.docx"
									class="hidden"
									onchange={handleFileSelect}
									required
								/>
								<label for="resume" class="cursor-pointer">
									<Upload class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
									{#if fileName}
										<p class="text-sm font-medium mb-2">{fileName}</p>
										<p class="text-xs text-muted-foreground">Click to change file</p>
									{:else}
										<p class="text-sm font-medium mb-2">Click to upload or drag and drop</p>
										<p class="text-xs text-muted-foreground">PDF or DOCX (max 5MB)</p>
									{/if}
								</label>
							</div>

							<div class="flex justify-end">
								<Button type="submit" disabled={loading || !fileName}>
									{loading ? 'Uploading...' : 'Continue'}
									<ChevronRight class="w-4 h-4 ml-2" />
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

		{:else if currentStep === 2}
			<!-- Step 2: Add Profile Links -->
			<Card>
				<CardHeader>
					<CardTitle>Connect Your Profiles</CardTitle>
					<CardDescription>Add your professional profiles to help us match you with better opportunities. All fields are optional.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						method="POST"
						action="?/updateProfiles"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<div class="space-y-6">
							<div class="space-y-2">
								<Label for="linkedinUrl">LinkedIn Profile URL</Label>
								<Input
									id="linkedinUrl"
									name="linkedinUrl"
									type="url"
									placeholder="https://linkedin.com/in/yourprofile"
								/>
							</div>

							<div class="space-y-2">
								<Label for="githubUrl">GitHub Profile URL</Label>
								<Input
									id="githubUrl"
									name="githubUrl"
									type="url"
									placeholder="https://github.com/yourusername"
								/>
							</div>

							<div class="space-y-2">
								<Label>Portfolio URLs</Label>
								<p class="text-xs text-muted-foreground mb-2">Add links to your portfolio, Dribbble, Behance, personal website, etc.</p>

								<input type="hidden" name="portfolioUrls" value={portfolioUrls.join('\n')} />

								{#if portfolioUrls.length > 0}
									<div class="flex flex-wrap gap-2 mb-2">
										{#each portfolioUrls as url}
											<Badge variant="secondary" class="gap-1">
												{url}
												<button type="button" onclick={() => removePortfolioUrl(url)} class="ml-1">×</button>
											</Badge>
										{/each}
									</div>
								{/if}

								<div class="flex gap-2">
									<Input
										placeholder="https://example.com/portfolio"
										bind:value={newPortfolioUrl}
										type="url"
										onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addPortfolioUrl())}
									/>
									<Button type="button" variant="outline" onclick={addPortfolioUrl}>
										Add
									</Button>
								</div>
							</div>

							<div class="flex justify-between">
								<Button type="button" variant="outline" onclick={() => currentStep = 1}>
									<ChevronLeft class="w-4 h-4 mr-2" />
									Back
								</Button>
								<Button type="submit" disabled={loading}>
									{loading ? 'Saving...' : 'Continue'}
									<ChevronRight class="w-4 h-4 ml-2" />
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

		{:else if currentStep === 3}
			<!-- Step 3: Ideal Job Description -->
			<Card>
				<CardHeader>
					<CardTitle>Describe Your Ideal Job</CardTitle>
					<CardDescription>Help us understand what you're looking for. Be as specific as possible about role, company, culture, compensation, and location preferences.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						method="POST"
						action="?/updateIdealJob"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<div class="space-y-6">
							<!-- Example -->
							<div class="bg-muted/50 rounded-lg p-4 border border-muted">
								<p class="text-sm font-medium mb-2">Example:</p>
								<p class="text-sm text-muted-foreground italic">{exampleIdealJob}</p>
							</div>

							<div class="space-y-2">
								<Label for="idealJobDescription">Your Ideal Job</Label>
								<Textarea
									id="idealJobDescription"
									name="idealJobDescription"
									rows={8}
									placeholder="Describe your ideal role, company size, industry, remote preference, salary expectations, key technologies, etc."
									required
									class="resize-none"
								/>
								<p class="text-xs text-muted-foreground">Minimum 50 characters</p>
							</div>

							<div class="flex justify-between">
								<Button type="button" variant="outline" onclick={() => currentStep = 2}>
									<ChevronLeft class="w-4 h-4 mr-2" />
									Back
								</Button>
								<Button type="submit" disabled={loading}>
									{loading ? 'Saving...' : 'Continue'}
									<ChevronRight class="w-4 h-4 ml-2" />
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

		{:else if currentStep === 4}
			<!-- Step 4: Confirmation -->
			<Card>
				<CardHeader>
					<CardTitle>You're All Set!</CardTitle>
					<CardDescription>Review your information and start your automated job hunt.</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-6">
						<div class="space-y-4">
							<div class="flex items-start gap-3">
								<CheckCircle2 class="w-5 h-5 text-primary mt-0.5" />
								<div>
									<p class="font-medium">Resume Uploaded</p>
									<p class="text-sm text-muted-foreground">We'll use this to match you with relevant jobs</p>
								</div>
							</div>

							<div class="flex items-start gap-3">
								<CheckCircle2 class="w-5 h-5 text-primary mt-0.5" />
								<div>
									<p class="font-medium">Profiles Connected</p>
									<p class="text-sm text-muted-foreground">Your professional presence is ready</p>
								</div>
							</div>

							<div class="flex items-start gap-3">
								<CheckCircle2 class="w-5 h-5 text-primary mt-0.5" />
								<div>
									<p class="font-medium">Ideal Job Defined</p>
									<p class="text-sm text-muted-foreground">We know exactly what you're looking for</p>
								</div>
							</div>
						</div>

						<div class="bg-primary/5 rounded-lg p-4 border border-primary/20">
							<p class="text-sm font-medium mb-2">Free Tier Benefits</p>
							<ul class="text-sm text-muted-foreground space-y-1">
								<li>• 5 job matches per week</li>
								<li>• 5 resume generations per week</li>
								<li>• Automatic job discovery</li>
								<li>• AI-powered matching</li>
							</ul>
						</div>

						<form
							method="POST"
							action="?/complete"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update();
								};
							}}
						>
							<div class="flex justify-between">
								<Button type="button" variant="outline" onclick={() => currentStep = 3}>
									<ChevronLeft class="w-4 h-4 mr-2" />
									Back
								</Button>
								<Button type="submit" disabled={loading}>
									{loading ? 'Setting up...' : 'Start Job Hunting'}
									<ChevronRight class="w-4 h-4 ml-2" />
								</Button>
							</div>
						</form>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Progress indicator -->
		<div class="text-center mt-6">
			<p class="text-sm text-muted-foreground">
				Step {currentStep} of {TOTAL_STEPS}
			</p>
		</div>
	</div>
</div>
