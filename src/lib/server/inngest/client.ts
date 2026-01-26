import { Inngest } from 'inngest';
import { env } from '$env/dynamic/private';

// Create the Inngest client
// Note: isDev must be explicitly set to false for Cloudflare Workers
// because the SDK cannot auto-detect the production environment
export const inngest = new Inngest({
	id: 'resume-pilot',
	eventKey: env.INNGEST_EVENT_KEY,
	isDev: false
});

// Define event types for type safety
export type Events = {
	'job/discovery.requested': {
		data: {
			userId: string;
		};
	};
	'job/discovered': {
		data: {
			userId: string;
			jobId: string;
		};
	};
	'resume/generation.requested': {
		data: {
			userId: string;
			jobId: string;
			applicationId: string;
		};
	};
	'resume/parsing.requested': {
		data: {
			userId: string;
			resumeId: string;
			fileUrl: string;
			fileType: 'pdf' | 'docx';
		};
	};
	'profile/sync.requested': {
		data: {
			userId: string;
			linkedinUrl?: string;
			githubHandle?: string;
		};
	};
	'profile/embedding.requested': {
		data: {
			userId: string;
			profileId: string;
		};
	};
};
