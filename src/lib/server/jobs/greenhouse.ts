import type { JobResult, JobSearchParams } from './types';
import { withCache } from '$lib/server/cache/redis';
import {
	type ATSCompany,
	getPrioritizedCompanies,
	getUniqueCompanies
} from './data/greenhouse-companies';

/**
 * Configuration for parallel fetching
 */
const FETCH_CONFIG = {
	/** Number of companies to fetch in parallel per batch */
	batchSize: 10,
	/** Delay between batches in milliseconds (rate limiting) */
	delayBetweenBatches: 100,
	/** Maximum number of companies to query */
	maxCompanies: 50,
	/** Timeout for individual fetch requests */
	fetchTimeout: 5000,
	/** Cache TTL for company job listings (2 hours) */
	cacheTtlSeconds: 7200,
	/** Maximum results to return */
	maxResults: 100
};

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

interface CompanyJobsResult {
	company: ATSCompany;
	jobs: GreenhouseJob[];
	error?: string;
}

/**
 * Fetch jobs from a single Greenhouse company board with caching
 */
async function fetchCompanyJobs(company: ATSCompany): Promise<CompanyJobsResult> {
	const cacheKey = `greenhouse:${company.slug}:jobs`;

	try {
		const jobs = await withCache(
			cacheKey,
			async () => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), FETCH_CONFIG.fetchTimeout);

				try {
					const url = `https://api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;
					const response = await fetch(url, { signal: controller.signal });

					if (!response.ok) {
						// Company might not exist or API changed
						return [];
					}

					const data: GreenhouseResponse = await response.json();
					return data.jobs || [];
				} finally {
					clearTimeout(timeoutId);
				}
			},
			FETCH_CONFIG.cacheTtlSeconds
		);

		return { company, jobs };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error(`Error fetching Greenhouse jobs for ${company.slug}:`, errorMessage);
		return { company, jobs: [], error: errorMessage };
	}
}

/**
 * Fetch jobs from multiple companies in parallel batches
 */
async function fetchJobsInBatches(companies: ATSCompany[]): Promise<CompanyJobsResult[]> {
	const results: CompanyJobsResult[] = [];

	// Process companies in batches
	for (let i = 0; i < companies.length; i += FETCH_CONFIG.batchSize) {
		const batch = companies.slice(i, i + FETCH_CONFIG.batchSize);

		// Fetch batch in parallel
		const batchResults = await Promise.all(batch.map(fetchCompanyJobs));
		results.push(...batchResults);

		// Add delay between batches to avoid rate limiting (except after last batch)
		if (i + FETCH_CONFIG.batchSize < companies.length) {
			await delay(FETCH_CONFIG.delayBetweenBatches);
		}
	}

	return results;
}

/**
 * Utility to create a delay
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Filter jobs based on search parameters
 */
function filterJob(
	job: GreenhouseJob,
	params: JobSearchParams
): { matches: boolean; isRemote: boolean } {
	const titleLower = job.title.toLowerCase();
	const locationLower = job.location?.name?.toLowerCase() || '';
	const contentLower = job.content?.toLowerCase() || '';

	// Filter by role keywords
	const matchesRole =
		params.roles.length === 0 ||
		params.roles.some((role) => titleLower.includes(role.toLowerCase()));

	if (!matchesRole) {
		return { matches: false, isRemote: false };
	}

	// Check for remote
	const isRemote =
		locationLower.includes('remote') ||
		titleLower.includes('remote') ||
		contentLower.includes('remote');

	// Filter by location
	const matchesLocation =
		params.locations.length === 0 ||
		params.locations.some((loc) => locationLower.includes(loc.toLowerCase()));

	// Job matches if location matches OR if it's remote
	const matches = matchesLocation || isRemote;

	return { matches, isRemote };
}

/**
 * Convert Greenhouse job to standardized JobResult
 */
function toJobResult(job: GreenhouseJob, company: ATSCompany, isRemote: boolean): JobResult {
	return {
		externalId: job.id.toString(),
		source: 'greenhouse',
		sourceUrl: job.absolute_url,
		title: job.title,
		company: company.name,
		location: job.location?.name,
		isRemote,
		description: job.content,
		requirements: extractRequirements(job.content || ''),
		postedAt: job.updated_at
	};
}

/**
 * Search for jobs across Greenhouse company boards
 *
 * Features:
 * - Parallel fetching with batching
 * - Rate limiting between batches
 * - Redis caching for individual company results
 * - Priority-based company selection
 */
export async function searchGreenhouseJobs(params: JobSearchParams): Promise<JobResult[]> {
	// Get unique, prioritized companies
	const uniqueCompanies = getUniqueCompanies();
	const prioritizedCompanies = getPrioritizedCompanies(FETCH_CONFIG.maxCompanies).filter((c) =>
		uniqueCompanies.some((uc) => uc.slug === c.slug)
	);

	// Fetch jobs from all companies in parallel batches
	const companyResults = await fetchJobsInBatches(prioritizedCompanies);

	// Process results and filter jobs
	const jobs: JobResult[] = [];
	let successCount = 0;
	let errorCount = 0;

	for (const result of companyResults) {
		if (result.error) {
			errorCount++;
			continue;
		}
		successCount++;

		for (const job of result.jobs) {
			const { matches, isRemote } = filterJob(job, params);

			if (matches) {
				jobs.push(toJobResult(job, result.company, isRemote));

				// Early exit if we have enough results
				if (jobs.length >= FETCH_CONFIG.maxResults) {
					break;
				}
			}
		}

		if (jobs.length >= FETCH_CONFIG.maxResults) {
			break;
		}
	}

	// Log fetch statistics
	console.log(
		`Greenhouse: Fetched from ${successCount} companies (${errorCount} errors), found ${jobs.length} matching jobs`
	);

	return jobs.slice(0, FETCH_CONFIG.maxResults);
}

/**
 * Simple requirement extraction from job description
 */
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

/**
 * Get fetch statistics and configuration
 * Useful for debugging and monitoring
 */
export function getGreenhouseFetchConfig() {
	const companies = getUniqueCompanies();
	return {
		totalCompanies: companies.length,
		maxCompaniesToFetch: FETCH_CONFIG.maxCompanies,
		batchSize: FETCH_CONFIG.batchSize,
		delayBetweenBatches: FETCH_CONFIG.delayBetweenBatches,
		cacheTtlSeconds: FETCH_CONFIG.cacheTtlSeconds,
		estimatedBatches: Math.ceil(
			Math.min(companies.length, FETCH_CONFIG.maxCompanies) / FETCH_CONFIG.batchSize
		),
		estimatedMinFetchTime:
			Math.ceil(
				Math.min(companies.length, FETCH_CONFIG.maxCompanies) / FETCH_CONFIG.batchSize
			) * FETCH_CONFIG.delayBetweenBatches
	};
}
