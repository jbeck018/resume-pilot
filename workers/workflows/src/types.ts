// Types for Cloudflare Workflows
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// Workflow binding type — matches Cloudflare's runtime interface
interface WorkflowBinding {
	create(options: { id: string; params: unknown }): Promise<{ id: string; status(): Promise<unknown> }>;
	get(id: string): Promise<{ id: string; status(): Promise<unknown> }>;
}

// Environment bindings
export interface Env {
	// Workflow bindings
	RESUME_GENERATION: WorkflowBinding;
	RESUME_PARSING: WorkflowBinding;
	JOB_DISCOVERY: WorkflowBinding;
	PROFILE_SYNC: WorkflowBinding;
	WEEKLY_SUMMARY: WorkflowBinding;

	// Secrets
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	ANTHROPIC_API_KEY: string;
	CLOUDFLARE_AI_GATEWAY_URL?: string;
	RESEND_API_KEY?: string;
	LANGFUSE_PUBLIC_KEY?: string;
	LANGFUSE_SECRET_KEY?: string;
	LANGFUSE_HOST?: string;

	// Variables
	ENVIRONMENT: string;
}

// Resume Generation Workflow
export interface ResumeGenerationParams {
	userId: string;
	jobId: string;
	applicationId: string;
	skipUsageCheck?: boolean;
}

export interface ResumeGenerationResult {
	success: boolean;
	matchScore?: number;
	atsScore?: number;
	qualityScore?: number;
	resumeLength?: number;
	error?: string;
}

// Resume Parsing Workflow
export interface ResumeParsingParams {
	userId: string;
	resumeId: string;
	fileUrl: string;
	fileType: 'pdf' | 'docx';
}

export interface ResumeParsingResult {
	success: boolean;
	extractedLength?: number;
	skillsCount?: number;
	experienceCount?: number;
	educationCount?: number;
	error?: string;
}

// Job Discovery Workflow
export interface JobDiscoveryParams {
	userId: string;
	searchCriteria?: {
		keywords?: string[];
		location?: string;
		remote?: boolean;
	};
}

export interface JobDiscoveryResult {
	success: boolean;
	jobsFound?: number;
	sourcesSearched?: number;
	error?: string;
}

// Profile Sync Workflow
export interface ProfileSyncParams {
	userId: string;
	githubHandle?: string;
}

export interface ProfileSyncResult {
	success: boolean;
	skillsExtracted?: number;
	projectsFound?: number;
	error?: string;
}

// Weekly Summary Workflow
export interface WeeklySummaryParams {
	// Empty for cron-triggered
}

export interface WeeklySummaryResult {
	success: boolean;
	totalUsers?: number;
	sent?: number;
	failed?: number;
	skipped?: number;
	error?: string;
}

// API Request types
export interface WorkflowTriggerRequest {
	workflow: 'resume-generation' | 'resume-parsing' | 'job-discovery' | 'profile-sync' | 'weekly-summary';
	params: ResumeGenerationParams | ResumeParsingParams | JobDiscoveryParams | ProfileSyncParams | WeeklySummaryParams;
	instanceId?: string;
}

export interface WorkflowStatusRequest {
	workflow: string;
	instanceId: string;
}

// Re-export for convenience
export type { WorkflowEvent, WorkflowStep };
