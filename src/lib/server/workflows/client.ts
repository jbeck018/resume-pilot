// Cloudflare Workflows Client
// Replaces Inngest for triggering background jobs
// Calls the deployed howlerhire-workflows Worker

import { env } from '$env/dynamic/private';

// Workflow types that can be triggered
export type WorkflowType =
	| 'resume-generation'
	| 'resume-parsing'
	| 'job-discovery'
	| 'profile-sync'
	| 'weekly-summary';

// Parameter types for each workflow
export interface ResumeGenerationParams {
	userId: string;
	jobId: string;
	applicationId: string;
	skipUsageCheck?: boolean;
}

export interface ResumeParsingParams {
	userId: string;
	resumeId: string;
	fileUrl: string;
	fileType: 'pdf' | 'docx';
}

export interface JobDiscoveryParams {
	userId: string;
	searchCriteria?: {
		keywords?: string[];
		location?: string;
		remote?: boolean;
	};
}

export interface ProfileSyncParams {
	userId: string;
	githubHandle?: string;
}

export interface WeeklySummaryParams {
	// Empty for cron-triggered
}

// Workflow status response
export interface WorkflowStatus {
	status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waiting';
	output?: unknown;
	error?: {
		name: string;
		message: string;
	};
}

// Trigger response
export interface TriggerResponse {
	success: boolean;
	instanceId: string;
	status: WorkflowStatus;
}

/**
 * Cloudflare Workflows client for triggering and managing workflows
 */
export class WorkflowsClient {
	private baseUrl: string;
	private authToken: string;

	constructor() {
		// Get the workflows worker URL from environment
		this.baseUrl = env.WORKFLOWS_WORKER_URL || 'https://howlerhire-workflows.workers.dev';
		this.authToken = env.WORKFLOWS_AUTH_TOKEN || '';
	}

	/**
	 * Trigger a workflow
	 */
	async trigger<T extends WorkflowType>(
		workflow: T,
		params: T extends 'resume-generation'
			? ResumeGenerationParams
			: T extends 'resume-parsing'
				? ResumeParsingParams
				: T extends 'job-discovery'
					? JobDiscoveryParams
					: T extends 'profile-sync'
						? ProfileSyncParams
						: WeeklySummaryParams,
		instanceId?: string
	): Promise<TriggerResponse> {
		const response = await fetch(`${this.baseUrl}/trigger`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.authToken}`
			},
			body: JSON.stringify({
				workflow,
				params,
				instanceId
			})
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(`Failed to trigger workflow: ${(error as { error: string }).error}`);
		}

		return response.json();
	}

	/**
	 * Get the status of a workflow instance
	 */
	async getStatus(workflow: WorkflowType, instanceId: string): Promise<WorkflowStatus> {
		const response = await fetch(`${this.baseUrl}/status`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.authToken}`
			},
			body: JSON.stringify({
				workflow,
				instanceId
			})
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(`Failed to get status: ${(error as { error: string }).error}`);
		}

		return response.json();
	}

	/**
	 * Helper method to trigger resume generation
	 */
	async generateResume(
		userId: string,
		jobId: string,
		applicationId: string,
		skipUsageCheck = false
	): Promise<TriggerResponse> {
		return this.trigger('resume-generation', {
			userId,
			jobId,
			applicationId,
			skipUsageCheck
		});
	}

	/**
	 * Helper method to trigger resume parsing
	 */
	async parseResume(
		userId: string,
		resumeId: string,
		fileUrl: string,
		fileType: 'pdf' | 'docx'
	): Promise<TriggerResponse> {
		return this.trigger('resume-parsing', {
			userId,
			resumeId,
			fileUrl,
			fileType
		});
	}

	/**
	 * Helper method to trigger job discovery
	 */
	async discoverJobs(
		userId: string,
		searchCriteria?: JobDiscoveryParams['searchCriteria']
	): Promise<TriggerResponse> {
		return this.trigger('job-discovery', {
			userId,
			searchCriteria
		});
	}

	/**
	 * Helper method to trigger profile sync
	 */
	async syncProfile(userId: string, githubHandle?: string): Promise<TriggerResponse> {
		return this.trigger('profile-sync', {
			userId,
			githubHandle
		});
	}
}

// Singleton instance
export const workflowsClient = new WorkflowsClient();

// Re-export for convenience - allows gradual migration from Inngest
export const workflows = {
	/**
	 * Send a workflow event (similar to inngest.send)
	 * Provides compatibility layer for existing Inngest usage
	 */
	async send(event: {
		name: string;
		data: Record<string, unknown>;
	}): Promise<{ instanceId: string }> {
		const { name, data } = event;

		// Map Inngest event names to workflow types
		const workflowMap: Record<string, WorkflowType> = {
			'resume/generation.requested': 'resume-generation',
			'resume/parsing.requested': 'resume-parsing',
			'jobs/discovery.requested': 'job-discovery',
			'profile/sync.requested': 'profile-sync',
			'email/weekly-summary': 'weekly-summary'
		};

		const workflow = workflowMap[name];
		if (!workflow) {
			throw new Error(`Unknown workflow event: ${name}`);
		}

		const result = await workflowsClient.trigger(workflow, data as never);
		return { instanceId: result.instanceId };
	}
};
