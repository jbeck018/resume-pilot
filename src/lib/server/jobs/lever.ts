import type { JobResult, JobSearchParams } from './types';

// List of companies known to use Lever
// This would be expanded over time or discovered dynamically
const LEVER_COMPANIES = [
	{ slug: 'netflix', name: 'Netflix' },
	{ slug: 'shopify', name: 'Shopify' },
	{ slug: 'spotify', name: 'Spotify' },
	{ slug: 'grammarly', name: 'Grammarly' },
	{ slug: 'canva', name: 'Canva' },
	{ slug: 'robinhood', name: 'Robinhood' },
	{ slug: 'square', name: 'Square' },
	{ slug: 'lyft', name: 'Lyft' },
	{ slug: 'uber', name: 'Uber' },
	{ slug: 'peloton', name: 'Peloton' },
	{ slug: 'atlassian', name: 'Atlassian' },
	{ slug: 'twilio', name: 'Twilio' },
	{ slug: 'mongodb', name: 'MongoDB' },
	{ slug: 'reddit', name: 'Reddit' },
	{ slug: 'zoom', name: 'Zoom' }
];

interface LeverJob {
	id: string;
	text: string; // job title
	categories: {
		location?: string;
		team?: string;
		commitment?: string;
	};
	descriptionPlain?: string;
	lists?: Array<{ text: string; content: string }>;
	hostedUrl: string;
	createdAt: number;
}

interface LeverResponse {
	data?: LeverJob[];
}

export async function searchLeverJobs(params: JobSearchParams): Promise<JobResult[]> {
	const jobs: JobResult[] = [];

	// Search through known Lever companies
	// In production, this would be optimized with caching and parallel requests
	for (const company of LEVER_COMPANIES.slice(0, 5)) {
		// Limit API calls
		try {
			const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json`;

			const response = await fetch(url);

			if (!response.ok) {
				// Company might not exist or API changed
				continue;
			}

			const data: LeverJob[] | LeverResponse = await response.json();

			// Handle both response formats (array or object with data property)
			const jobsArray = Array.isArray(data) ? data : (data.data ?? []);

			for (const job of jobsArray) {
				// Filter by role keywords
				const titleLower = job.text.toLowerCase();
				const matchesRole =
					params.roles.length === 0 ||
					params.roles.some((role) => titleLower.includes(role.toLowerCase()));

				if (!matchesRole) continue;

				// Filter by location
				const locationLower = job.categories?.location?.toLowerCase() || '';
				const matchesLocation =
					params.locations.length === 0 ||
					params.locations.some((loc) => locationLower.includes(loc.toLowerCase()));

				// Check for remote
				const isRemote =
					locationLower.includes('remote') ||
					titleLower.includes('remote') ||
					(job.descriptionPlain?.toLowerCase().includes('remote') ?? false);

				if (!matchesLocation && !isRemote) continue;

				// Extract requirements from description and lists
				const description = job.descriptionPlain || '';
				const listsContent =
					job.lists?.map((list) => `${list.text}: ${list.content}`).join('\n') || '';
				const fullContent = `${description}\n${listsContent}`;

				const requirements = extractRequirements(fullContent);

				// Determine employment type from commitment category
				const employmentType = job.categories?.commitment || undefined;

				jobs.push({
					externalId: job.id,
					source: 'lever',
					sourceUrl: job.hostedUrl,
					title: job.text,
					company: company.name,
					location: job.categories?.location,
					isRemote,
					description: job.descriptionPlain,
					requirements,
					employmentType,
					postedAt: new Date(job.createdAt).toISOString()
				});
			}
		} catch (error) {
			console.error(`Error searching Lever (${company.slug}):`, error);
		}
	}

	return jobs.slice(0, 20); // Limit results
}

// Simple requirement extraction from job description
function extractRequirements(content: string): string[] {
	const requirements: string[] = [];

	// Look for common requirement patterns
	const patterns = [
		/(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
		/experience\s+(?:with|in)\s+([^,.\n]+)/gi,
		/proficient\s+(?:with|in)\s+([^,.\n]+)/gi,
		/knowledge\s+of\s+([^,.\n]+)/gi,
		/bachelor'?s?\s+degree/gi,
		/master'?s?\s+degree/gi,
		/strong\s+understanding\s+of\s+([^,.\n]+)/gi,
		/expertise\s+(?:with|in)\s+([^,.\n]+)/gi
	];

	for (const pattern of patterns) {
		const matches = content.matchAll(pattern);
		for (const match of matches) {
			if (match[0] && !requirements.includes(match[0].trim())) {
				requirements.push(match[0].trim());
			}
		}
	}

	return requirements.slice(0, 10);
}
