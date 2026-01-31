import { Inngest } from 'inngest';

// Lazy-initialized Inngest client singleton
// Required for Cloudflare Workers where env vars aren't available at module load time
let _inngest: Inngest | null = null;

export function getInngest(eventKey?: string): Inngest {
	if (!_inngest) {
		_inngest = new Inngest({
			id: 'resume-pilot',
			eventKey: eventKey,
			// isDev must be explicitly set to false for Cloudflare Workers
			// because the SDK cannot auto-detect the production environment
			isDev: false
		});
	}
	return _inngest;
}

// For backwards compatibility - creates client without explicit event key
// The Inngest SDK automatically reads INNGEST_EVENT_KEY from environment variables
// This works on all platforms including Cloudflare Workers/Pages
export const inngest = new Inngest({
	id: 'resume-pilot',
	isDev: false
	// Note: eventKey is automatically detected from INNGEST_EVENT_KEY env var
	// No need to explicitly pass it here
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
			skipUsageCheck?: boolean;
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
