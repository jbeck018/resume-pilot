import type { JobResult, JobSearchParams } from './types';

const REMOTEOK_BASE_URL = 'https://remoteok.com/api';

interface RemoteOKJob {
	slug: string;
	id: string;
	epoch: number;
	date: string;
	company: string;
	company_logo?: string;
	position: string;
	tags?: string[];
	description?: string;
	location?: string;
	salary_min?: number;
	salary_max?: number;
	url: string;
}

// First element in the response is a legal disclaimer, not a job
type RemoteOKResponse = [{ legal: string }, ...RemoteOKJob[]];

export async function searchRemoteOKJobs(params: JobSearchParams): Promise<JobResult[]> {
	const jobs: JobResult[] = [];

	try {
		// RemoteOK requires a User-Agent header
		const response = await fetch(REMOTEOK_BASE_URL, {
			headers: {
				'User-Agent': 'ResumePilot/1.0 (job aggregator)',
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			console.error(`RemoteOK API error: ${response.status}`);
			return [];
		}

		const data: RemoteOKResponse = await response.json();

		// Skip the first element (legal disclaimer) and process jobs
		const jobListings = data.slice(1) as RemoteOKJob[];

		// Build search terms from roles and skills for filtering
		const searchTerms = [...params.roles, ...params.skills]
			.map((term) => term.toLowerCase())
			.filter(Boolean);

		for (const job of jobListings) {
			// Skip if no position title
			if (!job.position) continue;

			// Filter by search terms if provided
			if (searchTerms.length > 0) {
				const titleLower = job.position.toLowerCase();
				const tagsLower = (job.tags || []).map((t) => t.toLowerCase());
				const descriptionLower = (job.description || '').toLowerCase();

				const matchesSearch = searchTerms.some(
					(term) =>
						titleLower.includes(term) ||
						tagsLower.some((tag) => tag.includes(term)) ||
						descriptionLower.includes(term)
				);

				if (!matchesSearch) continue;
			}

			// Filter by location if provided (RemoteOK is all remote, but some have location preferences)
			if (params.locations.length > 0 && job.location) {
				const locationLower = job.location.toLowerCase();
				const matchesLocation =
					locationLower.includes('worldwide') ||
					locationLower.includes('anywhere') ||
					params.locations.some((loc) => locationLower.includes(loc.toLowerCase()));

				if (!matchesLocation) continue;
			}

			// Determine experience level from title or tags
			let experienceLevel: string | undefined;
			const titleLower = job.position.toLowerCase();
			if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('lead')) {
				experienceLevel = 'senior';
			} else if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('entry')) {
				experienceLevel = 'entry';
			} else if (titleLower.includes('staff') || titleLower.includes('principal')) {
				experienceLevel = 'senior';
			} else {
				experienceLevel = 'mid';
			}

			// Build the job URL - use the provided url or construct from id
			const sourceUrl = job.url || `https://remoteok.com/remote-jobs/${job.id}`;

			jobs.push({
				externalId: job.id || job.slug,
				source: 'remoteok',
				sourceUrl,
				title: job.position,
				company: job.company,
				companyLogo: job.company_logo,
				location: job.location || 'Remote',
				isRemote: true, // All RemoteOK jobs are remote
				description: job.description,
				requirements: extractRequirementsFromTags(job.tags),
				salaryMin: job.salary_min,
				salaryMax: job.salary_max,
				salaryCurrency: job.salary_min || job.salary_max ? 'USD' : undefined,
				experienceLevel,
				postedAt: job.date || new Date(job.epoch * 1000).toISOString()
			});

			// Limit results to avoid overwhelming the UI
			if (jobs.length >= 20) break;
		}
	} catch (error) {
		console.error('Error searching RemoteOK:', error);
	}

	return jobs;
}

// Extract requirements/skills from tags
function extractRequirementsFromTags(tags?: string[]): string[] | undefined {
	if (!tags || tags.length === 0) return undefined;

	// RemoteOK tags are typically skills/technologies
	return tags.slice(0, 10).map((tag) => {
		// Capitalize first letter of each word
		return tag
			.split(/[-_\s]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	});
}
