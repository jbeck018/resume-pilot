import type { JobResult, JobSearchParams } from './types';

// List of companies known to use Greenhouse
// This would be expanded over time or discovered dynamically
const GREENHOUSE_COMPANIES = [
	{ slug: 'airbnb', name: 'Airbnb' },
	{ slug: 'stripe', name: 'Stripe' },
	{ slug: 'figma', name: 'Figma' },
	{ slug: 'notion', name: 'Notion' },
	{ slug: 'discord', name: 'Discord' },
	{ slug: 'gitlab', name: 'GitLab' },
	{ slug: 'twitch', name: 'Twitch' },
	{ slug: 'asana', name: 'Asana' },
	{ slug: 'dropbox', name: 'Dropbox' },
	{ slug: 'pinterest', name: 'Pinterest' },
	{ slug: 'coinbase', name: 'Coinbase' },
	{ slug: 'ramp', name: 'Ramp' },
	{ slug: 'plaid', name: 'Plaid' },
	{ slug: 'vercel', name: 'Vercel' },
	{ slug: 'supabase', name: 'Supabase' },
	{ slug: 'linear', name: 'Linear' },
	{ slug: 'airtable', name: 'Airtable' },
	{ slug: 'retool', name: 'Retool' },
	{ slug: 'databricks', name: 'Databricks' },
	{ slug: 'amplitude', name: 'Amplitude' }
];

interface GreenhouseJob {
	id: number;
	title: string;
	location: { name: string };
	content: string;
	updated_at: string;
	absolute_url: string;
	metadata?: Array<{ name: string; value: string }>;
	departments?: Array<{ name: string }>;
}

interface GreenhouseResponse {
	jobs: GreenhouseJob[];
}

export async function searchGreenhouseJobs(params: JobSearchParams): Promise<JobResult[]> {
	const jobs: JobResult[] = [];

	// Search through known Greenhouse companies
	// In production, this would be optimized with caching and parallel requests
	for (const company of GREENHOUSE_COMPANIES.slice(0, 5)) {
		// Limit API calls
		try {
			const url = `https://api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;

			const response = await fetch(url);

			if (!response.ok) {
				// Company might not exist or API changed
				continue;
			}

			const data: GreenhouseResponse = await response.json();

			for (const job of data.jobs) {
				// Filter by role keywords
				const titleLower = job.title.toLowerCase();
				const matchesRole =
					params.roles.length === 0 ||
					params.roles.some((role) => titleLower.includes(role.toLowerCase()));

				if (!matchesRole) continue;

				// Filter by location
				const locationLower = job.location?.name?.toLowerCase() || '';
				const matchesLocation =
					params.locations.length === 0 ||
					params.locations.some((loc) => locationLower.includes(loc.toLowerCase()));

				// Check for remote
				const isRemote =
					locationLower.includes('remote') ||
					titleLower.includes('remote') ||
					(job.content?.toLowerCase().includes('remote') ?? false);

				if (!matchesLocation && !isRemote) continue;

				// Extract requirements from content using simple parsing
				const requirements = extractRequirements(job.content || '');

				jobs.push({
					externalId: job.id.toString(),
					source: 'greenhouse',
					sourceUrl: job.absolute_url,
					title: job.title,
					company: company.name,
					location: job.location?.name,
					isRemote,
					description: job.content,
					requirements,
					postedAt: job.updated_at
				});
			}
		} catch (error) {
			console.error(`Error searching Greenhouse (${company.slug}):`, error);
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
		/master'?s?\s+degree/gi
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

// Future enhancement: Apify/Scrapingdog integration for Indeed, LinkedIn, Glassdoor
// Requires paid API subscriptions - see docs/job-sources.md for setup
