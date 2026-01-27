<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {
		FileText,
		Upload,
		Star,
		Trash2,
		Download,
		Edit2,
		RefreshCw,
		Check,
		X,
		Loader2,
		Eye,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type StructuredData = {
		name?: string;
		email?: string;
		phone?: string;
		summary?: string;
		skills?: string[];
		experience?: Array<{
			title: string;
			company: string;
			location?: string;
			startDate?: string;
			endDate?: string;
			current?: boolean;
			description?: string;
		}>;
		education?: Array<{
			institution: string;
			degree: string;
			field?: string;
			startDate?: string;
			endDate?: string;
		}>;
		certifications?: string[];
	};

	type Resume = {
		id: string;
		name: string;
		is_default: boolean;
		original_file_url: string | null;
		original_file_name: string | null;
		original_file_type: string | null;
		parsed_content: string | null;
		structured_data: StructuredData | null;
		created_at: string;
		updated_at: string;
	};

	let showUploadForm = $state(false);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let selectedFile = $state<File | null>(null);
	let resumeName = $state('');
	let editingResumeId = $state<string | null>(null);
	let editingName = $state('');
	let deleteConfirmId = $state<string | null>(null);
	let expandedResumeId = $state<string | null>(null);
	let reparsingId = $state<string | null>(null);

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFile = input.files[0];
			// Auto-populate name from filename if empty
			if (!resumeName) {
				resumeName = selectedFile.name.replace(/\.(pdf|docx)$/i, '');
			}
		}
	}

	function resetUploadForm() {
		showUploadForm = false;
		selectedFile = null;
		resumeName = '';
		uploading = false;
		uploadProgress = 0;
	}

	function startEditing(id: string, name: string) {
		editingResumeId = id;
		editingName = name;
	}

	function cancelEditing() {
		editingResumeId = null;
		editingName = '';
	}

	function toggleExpand(resumeId: string) {
		if (expandedResumeId === resumeId) {
			expandedResumeId = null;
		} else {
			expandedResumeId = resumeId;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getFileIcon(fileType: string | null): string {
		if (fileType === 'pdf') return 'PDF';
		if (fileType === 'docx') return 'DOCX';
		return 'FILE';
	}

	$effect(() => {
		if (form?.success) {
			if (form.resumeId) {
				toast.success('Resume uploaded successfully! Parsing in progress...');
				resetUploadForm();
			} else if (form.message) {
				toast.success(form.message);
				reparsingId = null;
			} else {
				toast.success('Operation completed successfully');
				cancelEditing();
				deleteConfirmId = null;
			}
		}
		if (form?.error) {
			toast.error(form.error);
			uploading = false;
			reparsingId = null;
		}
	});
</script>

<svelte:head>
	<title>Resumes - HowlerHire</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold sm:text-3xl">Resumes</h1>
			<p class="text-sm text-muted-foreground sm:text-base">Manage your uploaded resumes</p>
		</div>
		<Button onclick={() => (showUploadForm = !showUploadForm)} class="w-full sm:w-auto">
			<Upload class="mr-2 h-4 w-4" />
			Upload Resume
		</Button>
	</div>

	<!-- Upload Form -->
	{#if showUploadForm}
		<Card>
			<CardHeader>
				<CardTitle>Upload New Resume</CardTitle>
				<CardDescription>Upload a PDF or DOCX file (max 10MB)</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/upload"
					enctype="multipart/form-data"
					use:enhance={() => {
						uploading = true;
						uploadProgress = 0;
						// Simulate progress
						const interval = setInterval(() => {
							if (uploadProgress < 90) {
								uploadProgress += 10;
							}
						}, 200);

						return async ({ result, update }) => {
							clearInterval(interval);
							uploadProgress = 100;
							await update();
							if (result.type === 'success') {
								await invalidateAll();
							}
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="name">Resume Name</Label>
						<Input
							id="name"
							name="name"
							bind:value={resumeName}
							placeholder="e.g., Software Engineer Resume"
						/>
					</div>

					<div class="space-y-2">
						<Label for="file">Resume File</Label>
						<div class="flex items-center gap-4">
							<Input
								id="file"
								name="file"
								type="file"
								accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
								onchange={handleFileSelect}
								class="flex-1"
							/>
						</div>
						{#if selectedFile}
							<p class="text-sm text-muted-foreground">
								Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
							</p>
						{/if}
					</div>

					{#if uploading}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span>Uploading...</span>
								<span>{uploadProgress}%</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-muted">
								<div
									class="h-full bg-primary transition-all duration-300"
									style="width: {uploadProgress}%"
								></div>
							</div>
						</div>
					{/if}

					<div class="flex gap-2">
						<Button type="submit" disabled={uploading || !selectedFile}>
							{#if uploading}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Uploading...
							{:else}
								<Upload class="mr-2 h-4 w-4" />
								Upload
							{/if}
						</Button>
						<Button type="button" variant="outline" onclick={resetUploadForm}>
							Cancel
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}

	<!-- Resumes List -->
	{#if data.resumes && data.resumes.length > 0}
		<div class="space-y-4">
			{#each data.resumes as resume (resume.id)}
				{@const isExpanded = expandedResumeId === resume.id}
				{@const isParsed = !!resume.parsed_content}
				{@const structured = resume.structured_data as StructuredData | null}
				<Card class="overflow-hidden transition-colors hover:border-primary/50">
					<CardContent class="pt-6">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div class="flex items-start gap-3 sm:gap-4">
								<!-- File Icon -->
								<div
									class="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 sm:h-14 sm:w-14"
								>
									<FileText class="h-5 w-5 text-primary sm:h-6 sm:w-6" />
									<span class="mt-0.5 text-[9px] font-medium text-primary sm:text-[10px]">
										{getFileIcon(resume.original_file_type)}
									</span>
								</div>

								<!-- Resume Info -->
								<div class="min-w-0 flex-1 space-y-1">
									{#if editingResumeId === resume.id}
										<form
											method="POST"
											action="?/rename"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
													await invalidateAll();
												};
											}}
											class="flex items-center gap-2"
										>
											<input type="hidden" name="resumeId" value={resume.id} />
											<Input
												name="name"
												bind:value={editingName}
												class="h-8 w-full max-w-48"
												autofocus
											/>
											<Button type="submit" size="icon" variant="ghost" class="h-8 w-8">
												<Check class="h-4 w-4" />
											</Button>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												class="h-8 w-8"
												onclick={cancelEditing}
											>
												<X class="h-4 w-4" />
											</Button>
										</form>
									{:else}
										<div class="flex flex-wrap items-center gap-2">
											<h3 class="text-base font-semibold sm:text-lg">{resume.name}</h3>
											{#if resume.is_default}
												<Badge variant="default" class="gap-1">
													<Star class="h-3 w-3" />
													Default
												</Badge>
											{/if}
											<Button
												variant="ghost"
												size="icon"
												class="h-6 w-6"
												onclick={() => startEditing(resume.id, resume.name)}
											>
												<Edit2 class="h-3 w-3" />
											</Button>
										</div>
									{/if}

									<p class="truncate text-sm text-muted-foreground">
										{resume.original_file_name || 'Unknown file'}
									</p>

									<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
										<span>Uploaded {formatDate(resume.created_at)}</span>
										{#if isParsed}
											<Badge variant="outline" class="text-xs">Parsed</Badge>
										{:else}
											<Badge variant="secondary" class="text-xs">Parsing...</Badge>
										{/if}
									</div>

									<!-- Quick Preview of Skills -->
									{#if structured?.skills && structured.skills.length > 0}
										<div class="mt-2 hidden flex-wrap gap-1 sm:flex">
											{#each structured.skills.slice(0, 5) as skill}
												<Badge variant="secondary" class="text-xs">{skill}</Badge>
											{/each}
											{#if structured.skills.length > 5}
												<Badge variant="outline" class="text-xs">
													+{structured.skills.length - 5} more
												</Badge>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<!-- Actions -->
							<div class="flex flex-col gap-2 border-t pt-4 sm:items-end sm:border-t-0 sm:pt-0">
								<div class="flex flex-wrap items-center gap-2">
									{#if !resume.is_default}
										<form
											method="POST"
											action="?/setDefault"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
													await invalidateAll();
												};
											}}
										>
											<input type="hidden" name="resumeId" value={resume.id} />
											<Button type="submit" variant="outline" size="sm">
												<Star class="mr-1 h-3 w-3" />
												Set Default
											</Button>
										</form>
									{/if}

									{#if resume.original_file_url}
										<Button
											variant="outline"
											size="sm"
											href={resume.original_file_url}
											target="_blank"
										>
											<Download class="mr-1 h-3 w-3" />
											Download
										</Button>
									{/if}
								</div>

								<div class="flex flex-wrap items-center gap-2">
									<form
										method="POST"
										action="?/reparse"
										use:enhance={() => {
											reparsingId = resume.id;
											return async ({ update }) => {
												await update();
												await invalidateAll();
											};
										}}
									>
										<input type="hidden" name="resumeId" value={resume.id} />
										<Button
											type="submit"
											variant="ghost"
											size="sm"
											disabled={reparsingId === resume.id}
										>
											{#if reparsingId === resume.id}
												<Loader2 class="mr-1 h-3 w-3 animate-spin" />
											{:else}
												<RefreshCw class="mr-1 h-3 w-3" />
											{/if}
											Re-parse
										</Button>
									</form>

									{#if isParsed}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => toggleExpand(resume.id)}
										>
											<Eye class="mr-1 h-3 w-3" />
											{isExpanded ? 'Hide' : 'Preview'}
											{#if isExpanded}
												<ChevronUp class="ml-1 h-3 w-3" />
											{:else}
												<ChevronDown class="ml-1 h-3 w-3" />
											{/if}
										</Button>
									{/if}

									{#if deleteConfirmId === resume.id}
										<div class="flex items-center gap-1">
											<span class="text-sm text-muted-foreground">Delete?</span>
											<form
												method="POST"
												action="?/delete"
												use:enhance={() => {
													return async ({ update }) => {
														await update();
														await invalidateAll();
													};
												}}
											>
												<input type="hidden" name="resumeId" value={resume.id} />
												<Button type="submit" variant="destructive" size="sm">
													Yes
												</Button>
											</form>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => (deleteConfirmId = null)}
											>
												No
											</Button>
										</div>
									{:else}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => (deleteConfirmId = resume.id)}
										>
											<Trash2 class="h-3 w-3 text-destructive" />
										</Button>
									{/if}
								</div>
							</div>
						</div>

						<!-- Expanded Content Preview -->
						{#if isExpanded && structured}
							<div class="mt-6 border-t pt-6">
								<div class="grid gap-6 md:grid-cols-2">
									<!-- Contact Info -->
									{#if structured.name || structured.email || structured.phone}
										<div>
											<h4 class="mb-2 font-semibold">Contact Information</h4>
											<div class="space-y-1 text-sm text-muted-foreground">
												{#if structured.name}
													<p><strong>Name:</strong> {structured.name}</p>
												{/if}
												{#if structured.email}
													<p><strong>Email:</strong> {structured.email}</p>
												{/if}
												{#if structured.phone}
													<p><strong>Phone:</strong> {structured.phone}</p>
												{/if}
											</div>
										</div>
									{/if}

									<!-- Summary -->
									{#if structured.summary}
										<div>
											<h4 class="mb-2 font-semibold">Summary</h4>
											<p class="text-sm text-muted-foreground line-clamp-4">
												{structured.summary}
											</p>
										</div>
									{/if}

									<!-- Skills -->
									{#if structured.skills && structured.skills.length > 0}
										<div>
											<h4 class="mb-2 font-semibold">Skills</h4>
											<div class="flex flex-wrap gap-1">
												{#each structured.skills as skill}
													<Badge variant="secondary" class="text-xs">{skill}</Badge>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Experience -->
									{#if structured.experience && structured.experience.length > 0}
										<div>
											<h4 class="mb-2 font-semibold">Experience</h4>
											<div class="space-y-2">
												{#each structured.experience.slice(0, 3) as exp}
													<div class="text-sm">
														<p class="font-medium">{exp.title}</p>
														<p class="text-muted-foreground">
															{exp.company}
															{#if exp.startDate}
																| {exp.startDate} - {exp.current ? 'Present' : exp.endDate || 'N/A'}
															{/if}
														</p>
													</div>
												{/each}
												{#if structured.experience.length > 3}
													<p class="text-xs text-muted-foreground">
														+{structured.experience.length - 3} more positions
													</p>
												{/if}
											</div>
										</div>
									{/if}

									<!-- Education -->
									{#if structured.education && structured.education.length > 0}
										<div>
											<h4 class="mb-2 font-semibold">Education</h4>
											<div class="space-y-2">
												{#each structured.education as edu}
													<div class="text-sm">
														<p class="font-medium">{edu.degree} {edu.field ? `in ${edu.field}` : ''}</p>
														<p class="text-muted-foreground">{edu.institution}</p>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Certifications -->
									{#if structured.certifications && structured.certifications.length > 0}
										<div>
											<h4 class="mb-2 font-semibold">Certifications</h4>
											<ul class="list-inside list-disc text-sm text-muted-foreground">
												{#each structured.certifications as cert}
													<li>{cert}</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else}
		<Card>
			<CardContent class="py-12 text-center">
				<FileText class="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 class="mt-4 text-lg font-semibold">No resumes uploaded</h3>
				<p class="mt-2 text-muted-foreground">
					Upload your resume to get started with tailored applications.
				</p>
				<Button class="mt-4" onclick={() => (showUploadForm = true)}>
					<Upload class="mr-2 h-4 w-4" />
					Upload Your First Resume
				</Button>
			</CardContent>
		</Card>
	{/if}

	<!-- Info Card -->
	<Card>
		<CardHeader>
			<CardTitle>How Resume Parsing Works</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-3">
				<div class="space-y-2">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<span class="text-lg font-bold text-primary">1</span>
					</div>
					<h4 class="font-semibold">Upload</h4>
					<p class="text-sm text-muted-foreground">
						Upload your resume in PDF or DOCX format. We support files up to 10MB.
					</p>
				</div>
				<div class="space-y-2">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<span class="text-lg font-bold text-primary">2</span>
					</div>
					<h4 class="font-semibold">Parse</h4>
					<p class="text-sm text-muted-foreground">
						Our AI extracts your skills, experience, education, and other details automatically.
					</p>
				</div>
				<div class="space-y-2">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<span class="text-lg font-bold text-primary">3</span>
					</div>
					<h4 class="font-semibold">Tailor</h4>
					<p class="text-sm text-muted-foreground">
						We use your parsed resume to generate tailored versions for each job application.
					</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>

<style>
	.line-clamp-4 {
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
