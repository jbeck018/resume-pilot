<script lang="ts">
	import { Button } from '$components/ui/button';
	import { ArrowRight, Briefcase, FileText, Sparkles } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Resume Pilot - AI-Powered Job Search</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b">
		<div class="container flex h-16 items-center justify-between">
			<div class="flex items-center gap-2">
				<Briefcase class="h-6 w-6" />
				<span class="text-xl font-bold">Resume Pilot</span>
			</div>
			<nav class="flex items-center gap-4">
				<Button variant="ghost" href="/auth/login">Log in</Button>
				<Button href="/auth/signup">Get Started</Button>
			</nav>
		</div>
	</header>

	<!-- Hero -->
	<main class="flex-1">
		<section class="container flex flex-col items-center gap-8 py-24 text-center">
			<div
				class="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm font-medium"
			>
				<Sparkles class="h-4 w-4" />
				AI-Powered Job Matching
			</div>

			<h1 class="max-w-3xl text-5xl font-bold leading-tight tracking-tight">
				Find Your Dream Job with
				<span class="text-primary">Personalized Resumes</span>
			</h1>

			<p class="max-w-2xl text-lg text-muted-foreground">
				Upload your resume and let AI find the perfect jobs for you. We automatically generate
				tailored resumes and cover letters for each opportunity.
			</p>

			<div class="flex gap-4">
				<Button size="lg" href="/auth/signup">
					Start Free
					<ArrowRight class="ml-2 h-4 w-4" />
				</Button>
				<Button size="lg" variant="outline" href="#features">Learn More</Button>
			</div>
		</section>

		<!-- Features -->
		<section id="features" class="border-t bg-muted/50 py-24">
			<div class="container">
				<h2 class="mb-12 text-center text-3xl font-bold">How It Works</h2>
				<div class="grid gap-8 md:grid-cols-3">
					<div class="rounded-lg border bg-card p-6">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<FileText class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-xl font-semibold">Upload Your Profile</h3>
						<p class="text-muted-foreground">
							Add your resume, LinkedIn profile, and GitHub. We build a comprehensive picture of
							your skills.
						</p>
					</div>

					<div class="rounded-lg border bg-card p-6">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Briefcase class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-xl font-semibold">Daily Job Discovery</h3>
						<p class="text-muted-foreground">
							Our AI scans thousands of jobs daily and finds the 20 best matches for your profile.
						</p>
					</div>

					<div class="rounded-lg border bg-card p-6">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Sparkles class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-xl font-semibold">Tailored Applications</h3>
						<p class="text-muted-foreground">
							Get a custom resume and cover letter for each job, optimized to highlight your
							relevant experience.
						</p>
					</div>
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t py-8">
		<div class="container text-center text-sm text-muted-foreground">
			<p>&copy; 2024 Resume Pilot. Built with AI.</p>
		</div>
	</footer>
</div>
