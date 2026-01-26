import type { JobResult, JobSearchParams } from './types';
import { env } from '$env/dynamic/private';

/**
 * Jooble Job Search API Integration
 *
 * Jooble is a free job aggregator with 800K+ jobs daily across 70+ countries.
 *
 * API Documentation: https://jooble.org/api/about
 * Get your free API key at: https://jooble.org/api/about
 *
 * Environment variable required:
 * - JOOBLE_API_KEY: Your Jooble API key (free tier available with generous limits)
 */

const JOOBLE_API_KEY = env.JOOBLE_API_KEY;
const JOOBLE_BASE_URL = 'https://jooble.org/api';

interface JoobleJob {
	id: string;
	title: string;
	location: string;
	snippet: string;
	salary: string;
	source: string;
	type: string;
	link: string;
	company: string;
	updated: string;
}

interface JoobleRequest {
	keywords?: string;
	location?: string;
	radius?: string;
	salary?: string;
	page?: string;
}

interface JoobleResponse {
	totalCount: number;
	jobs: JoobleJob[];
}

/**
 * Parse salary string into min/max numbers
 * Handles formats like:
 * - "$100,000 - $150,000"
 * - "$100K - $150K"
 * - "$100,000+"
 * - "$50/hr"
 * - "100000 - 150000"
 */
function parseSalary(salaryStr: string | undefined): { min?: number; max?: number } {
	if (!salaryStr || salaryStr.trim() === '') {
		return {};
	}

	// Remove currency symbols and commas
	const cleaned = salaryStr.replace(/[$,]/g, '').toLowerCase();

	// Handle hourly rates - convert to annual (assuming 2080 hours/year)
	const hourlyMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*hr|per\s*hour|hourly)/i);
	if (hourlyMatch) {
		const hourlyRate = parseFloat(hourlyMatch[1]);
		const annual = Math.round(hourlyRate * 2080);
		return { min: annual, max: annual };
	}

	// Handle "K" notation (e.g., "100K")
	const withK = cleaned.replace(/(\d+)k/gi, (_, num) => String(parseInt(num) * 1000));

	// Extract all numbers from the string
	const numbers = withK.match(/\d+(?:\.\d+)?/g);

	if (!numbers || numbers.length === 0) {
		return {};
	}

	const parsedNumbers = numbers.map((n) => Math.round(parseFloat(n)));

	if (parsedNumbers.length === 1) {
		// Single number - could be minimum or exact
		const value = parsedNumbers[0];
		// If string contains "+", treat as minimum only
		if (cleaned.includes('+')) {
			return { min: value };
		}
		return { min: value, max: value };
	}

	// Multiple numbers - assume first is min, second is max
	const [min, max] = parsedNumbers.sort((a, b) => a - b);
	return { min, max };
}

/**
 * Determine if a job is remote based on location and description
 */
function isJobRemote(job: JoobleJob): boolean {
	const locationLower = job.location?.toLowerCase() || '';
	const titleLower = job.title?.toLowerCase() || '';
	const snippetLower = job.snippet?.toLowerCase() || '';

	return (
		locationLower.includes('remote') ||
		locationLower.includes('work from home') ||
		locationLower.includes('anywhere') ||
		titleLower.includes('remote') ||
		snippetLower.includes('fully remote') ||
		snippetLower.includes('100% remote')
	);
}

/**
 * Extract employment type from job data
 */
function getEmploymentType(job: JoobleJob): string | undefined {
	const type = job.type?.toLowerCase() || '';
	const titleLower = job.title?.toLowerCase() || '';
	const snippetLower = job.snippet?.toLowerCase() || '';

	if (type.includes('full')) return 'full-time';
	if (type.includes('part')) return 'part-time';
	if (type.includes('contract')) return 'contract';
	if (type.includes('temp')) return 'temporary';
	if (type.includes('intern')) return 'internship';

	// Check title and snippet as fallback
	const combined = `${titleLower} ${snippetLower}`;
	if (combined.includes('full-time') || combined.includes('full time')) return 'full-time';
	if (combined.includes('part-time') || combined.includes('part time')) return 'part-time';
	if (combined.includes('contract')) return 'contract';
	if (combined.includes('internship') || combined.includes('intern')) return 'internship';

	return job.type || undefined;
}

/**
 * Search for jobs using the Jooble API
 */
export async function searchJoobleJobs(params: JobSearchParams): Promise<JobResult[]> {
	if (!JOOBLE_API_KEY) {
		console.warn('Jooble API key not configured. Set JOOBLE_API_KEY environment variable.');
		return [];
	}

	const jobs: JobResult[] = [];

	// Build search keywords from roles and skills
	const searchTerms = [...params.roles, ...params.skills.slice(0, 3)].filter(Boolean).join(' ');

	if (!searchTerms) {
		return [];
	}

	// Build location string
	let locationQuery = '';
	if (params.remotePreference === 'remote') {
		locationQuery = 'remote';
	} else if (params.locations.length > 0) {
		locationQuery = params.locations[0];
	}

	// Build request body
	const requestBody: JoobleRequest = {
		keywords: searchTerms,
		page: '1'
	};

	if (locationQuery) {
		requestBody.location = locationQuery;
	}

	// Add salary filter if specified
	if (params.salaryMin) {
		requestBody.salary = params.salaryMin.toString();
	}

	try {
		const url = `${JOOBLE_BASE_URL}/${JOOBLE_API_KEY}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			console.error(`Jooble API error: ${response.status} ${response.statusText}`);
			return [];
		}

		const data: JoobleResponse = await response.json();

		if (!data.jobs || !Array.isArray(data.jobs)) {
			return [];
		}

		for (const job of data.jobs.slice(0, 25)) {
			// Skip jobs without essential data
			if (!job.title || !job.link) {
				continue;
			}

			const salary = parseSalary(job.salary);
			const isRemote = isJobRemote(job);

			// Apply location filter for non-remote jobs if location preference exists
			if (!isRemote && params.locations.length > 0 && job.location) {
				const locationLower = job.location.toLowerCase();
				const matchesLocation = params.locations.some((loc) =>
					locationLower.includes(loc.toLowerCase())
				);
				if (!matchesLocation && params.remotePreference !== 'remote') {
					continue;
				}
			}

			jobs.push({
				externalId: job.id || `jooble-${Buffer.from(job.link).toString('base64').slice(0, 20)}`,
				source: 'jooble',
				sourceUrl: job.link,
				title: job.title,
				company: job.company || job.source || 'Unknown Company',
				location: job.location || undefined,
				isRemote,
				description: job.snippet || undefined,
				salaryMin: salary.min,
				salaryMax: salary.max,
				salaryCurrency: salary.min || salary.max ? 'USD' : undefined,
				employmentType: getEmploymentType(job),
				postedAt: job.updated || undefined
			});
		}
	} catch (error) {
		console.error('Error searching Jooble:', error);
	}

	return jobs;
}
