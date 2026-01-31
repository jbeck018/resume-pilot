<script lang="ts">
	import { Button } from '$components/ui/button';
	import { X, Download, FileText, Loader2 } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	interface ResumeData {
		name: string;
		email?: string;
		phone?: string;
		location?: string;
		linkedin?: string;
		website?: string;
		summary?: string;
		experience?: Array<{
			title: string;
			company: string;
			location?: string;
			startDate?: string;
			endDate?: string;
			current?: boolean;
			description?: string;
			highlights?: string[];
		}>;
		education?: Array<{
			institution: string;
			degree: string;
			field?: string;
			graduationDate?: string;
			gpa?: string;
		}>;
		skills?: string[];
		certifications?: string[];
	}

	interface Props {
		open: boolean;
		resume: ResumeData | null;
		onClose: () => void;
	}

	let { open, resume, onClose }: Props = $props();

	let isExporting = $state(false);

	async function handleExport() {
		if (!resume) return;

		isExporting = true;

		try {
			const response = await fetch('/api/builder/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ resume, format: 'pdf', style: 'classic' })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to export resume');
			}

			// Download the PDF
			const link = document.createElement('a');
			link.href = `data:application/pdf;base64,${data.pdf}`;
			link.download = data.filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (error) {
			console.error('Export error:', error);
			alert('Failed to export resume. Please try again.');
		} finally {
			isExporting = false;
		}
	}

	function formatDateRange(start?: string, end?: string, current?: boolean): string {
		if (!start) return '';
		const startFormatted = formatDate(start);
		const endFormatted = current ? 'Present' : formatDate(end);
		return `${startFormatted} - ${endFormatted}`;
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		} catch {
			return dateStr;
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="button"
		tabindex="-1"
	></div>

	<!-- Sheet Panel -->
	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-card shadow-xl"
		transition:fly={{ x: 100, duration: 200 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-4">
			<div class="flex items-center gap-2">
				<FileText class="h-5 w-5" />
				<h2 class="font-semibold">Resume Preview</h2>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={handleExport}
					disabled={isExporting || !resume}
				>
					{#if isExporting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Exporting...
					{:else}
						<Download class="mr-2 h-4 w-4" />
						Download PDF
					{/if}
				</Button>
				<Button variant="ghost" size="icon" onclick={onClose}>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if resume}
				<!-- Resume Preview -->
				<div class="mx-auto max-w-xl space-y-6 rounded-lg border bg-white p-8 shadow-sm dark:bg-zinc-900">
					<!-- Header -->
					<div class="text-center">
						<h1 class="text-2xl font-bold">{resume.name}</h1>
						{#if resume.email || resume.phone || resume.location}
							<p class="mt-1 text-sm text-muted-foreground">
								{[resume.email, resume.phone, resume.location].filter(Boolean).join(' | ')}
							</p>
						{/if}
						{#if resume.linkedin || resume.website}
							<p class="mt-1 text-sm text-blue-600">
								{[resume.linkedin, resume.website].filter(Boolean).join(' | ')}
							</p>
						{/if}
					</div>

					<!-- Summary -->
					{#if resume.summary}
						<div>
							<h2 class="mb-2 border-b pb-1 text-lg font-semibold">Summary</h2>
							<p class="text-sm">{resume.summary}</p>
						</div>
					{/if}

					<!-- Experience -->
					{#if resume.experience && resume.experience.length > 0}
						<div>
							<h2 class="mb-3 border-b pb-1 text-lg font-semibold">Experience</h2>
							<div class="space-y-4">
								{#each resume.experience as exp}
									<div>
										<div class="flex items-start justify-between">
											<div>
												<h3 class="font-semibold">{exp.title}</h3>
												<p class="text-sm text-muted-foreground">
													{exp.company}{exp.location ? ` | ${exp.location}` : ''}
												</p>
											</div>
											<span class="text-sm text-muted-foreground">
												{formatDateRange(exp.startDate, exp.endDate, exp.current)}
											</span>
										</div>
										{#if exp.description}
											<p class="mt-1 text-sm">{exp.description}</p>
										{/if}
										{#if exp.highlights && exp.highlights.length > 0}
											<ul class="mt-2 list-inside list-disc space-y-1 text-sm">
												{#each exp.highlights as highlight}
													<li>{highlight}</li>
												{/each}
											</ul>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Education -->
					{#if resume.education && resume.education.length > 0}
						<div>
							<h2 class="mb-3 border-b pb-1 text-lg font-semibold">Education</h2>
							<div class="space-y-3">
								{#each resume.education as edu}
									<div class="flex items-start justify-between">
										<div>
											<h3 class="font-semibold">
												{edu.degree}{edu.field ? ` in ${edu.field}` : ''}
											</h3>
											<p class="text-sm text-muted-foreground">
												{edu.institution}{edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
											</p>
										</div>
										{#if edu.graduationDate}
											<span class="text-sm text-muted-foreground">{edu.graduationDate}</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Skills -->
					{#if resume.skills && resume.skills.length > 0}
						<div>
							<h2 class="mb-2 border-b pb-1 text-lg font-semibold">Skills</h2>
							<p class="text-sm">{resume.skills.join(' • ')}</p>
						</div>
					{/if}

					<!-- Certifications -->
					{#if resume.certifications && resume.certifications.length > 0}
						<div>
							<h2 class="mb-2 border-b pb-1 text-lg font-semibold">Certifications</h2>
							<ul class="list-inside list-disc text-sm">
								{#each resume.certifications as cert}
									<li>{cert}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Empty State -->
				<div class="flex h-full items-center justify-center text-center">
					<div class="space-y-2">
						<FileText class="mx-auto h-12 w-12 text-muted-foreground" />
						<h3 class="font-semibold">No resume content yet</h3>
						<p class="text-sm text-muted-foreground">
							Start a conversation to generate your tailored resume content.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
