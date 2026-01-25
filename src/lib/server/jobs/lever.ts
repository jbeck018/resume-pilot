import type { JobResult, JobSearchParams } from './types';
import { LEVER_COMPANIES, PRIORITY_ORDER, type ATSCompany } from './data/lever-companies';

// Configuration
const BATCH_SIZE = 10; // Number of concurrent requests per batch
const DELAY_BETWEEN_BATCHES_MS = 100; // Rate limiting delay
const DEFAULT_COMPANY_LIMIT = 50; // Default number of companies to query
const MAX_RESULTS_PER_COMPANY = 100; // Max jobs to process per company
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

// Simple in-memory cache for company job listings
interface CacheEntry {
	data: LeverJob[];
	timestamp: number;
}
const jobCache = new Map<string, CacheEntry>();

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

interface FetchOptions {
	companyLimit?: number;
	batchSize?: number;
	delayMs?: number;
	useCache?: boolean;
}

/**
 * Fetch jobs from a single Lever company
 */
async function fetchCompanyJobs(company: ATSCompany, useCache: boolean): Promise<LeverJob[]> {
	// Check cache first
	if (useCache) {
		const cached = jobCache.get(company.slug);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
			return cached.data;
		}
	}

	try {
		const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json`;
		const response = await fetch(url);

		if (!response.ok) {
			return [];
		}

		const data: LeverJob[] | LeverResponse = await response.json();
		const jobs = Array.isArray(data) ? data : (data.data ?? []);

		// Update cache
		if (useCache) {
			jobCache.set(company.slug, {
				data: jobs,
				timestamp: Date.now()
			});
		}

		return jobs;
	} catch (error) {
		console.error(`Error fetching Lever jobs for ${company.slug}:`, error);
		return [];
	}
}

/**
 * Fetch jobs from multiple companies in parallel batches
 */
async function fetchJobsInBatches(
	companies: ATSCompany[],
	options: FetchOptions = {}
): Promise<Map<string, LeverJob[]>> {
	const { batchSize = BATCH_SIZE, delayMs = DELAY_BETWEEN_BATCHES_MS, useCache = true } = options;

	const results = new Map<string, LeverJob[]>();
	const batches: ATSCompany[][] = [];

	// Split companies into batches
	for (let i = 0; i < companies.length; i += batchSize) {
		batches.push(companies.slice(i, i + batchSize));
	}

	// Process batches sequentially, but requests within each batch run in parallel
	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];

		// Fetch all companies in this batch in parallel
		const batchPromises = batch.map(async (company) => {
			const jobs = await fetchCompanyJobs(company, useCache);
			return { company, jobs };
		});

		const batchResults = await Promise.all(batchPromises);

		// Store results
		for (const { company, jobs } of batchResults) {
			results.set(company.slug, jobs);
		}

		// Add delay between batches (except for the last batch)
		if (i < batches.length - 1 && delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	return results;
}

/**
 * Get prioritized list of companies to query
 */
function getPrioritizedCompanies(limit: number): ATSCompany[] {
	return [...LEVER_COMPANIES]
		.sort((a, b) => PRIORITY_ORDER[a.priority || 'low'] - PRIORITY_ORDER[b.priority || 'low'])
		.slice(0, limit);
}

/**
 * Filter a job against search parameters
 */
function matchesSearchParams(
	job: LeverJob,
	params: JobSearchParams
): { matches: boolean; isRemote: boolean } {
	const titleLower = job.text.toLowerCase();
	const locationLower = job.categories?.location?.toLowerCase() || '';
	const descriptionLower = job.descriptionPlain?.toLowerCase() || '';

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
		descriptionLower.includes('remote');

	// Filter by location
	const matchesLocation =
		params.locations.length === 0 ||
		params.locations.some((loc) => locationLower.includes(loc.toLowerCase()));

	// Match if location matches OR job is remote
	if (!matchesLocation && !isRemote) {
		return { matches: false, isRemote: false };
	}

	return { matches: true, isRemote };
}

/**
 * Convert a Lever job to JobResult format
 */
function convertToJobResult(job: LeverJob, companyName: string, isRemote: boolean): JobResult {
	const description = job.descriptionPlain || '';
	const listsContent = job.lists?.map((list) => `${list.text}: ${list.content}`).join('\n') || '';
	const fullContent = `${description}\n${listsContent}`;

	return {
		externalId: job.id,
		source: 'lever',
		sourceUrl: job.hostedUrl,
		title: job.text,
		company: companyName,
		location: job.categories?.location,
		isRemote,
		description: job.descriptionPlain,
		requirements: extractRequirements(fullContent),
		employmentType: job.categories?.commitment || undefined,
		postedAt: new Date(job.createdAt).toISOString()
	};
}

/**
 * Search for jobs across Lever companies
 */
export async function searchLeverJobs(
	params: JobSearchParams,
	options: FetchOptions = {}
): Promise<JobResult[]> {
	const { companyLimit = DEFAULT_COMPANY_LIMIT } = options;

	// Get prioritized companies
	const companies = getPrioritizedCompanies(companyLimit);

	// Fetch jobs from all companies in parallel batches
	const companyJobs = await fetchJobsInBatches(companies, options);

	// Process and filter jobs
	const jobs: JobResult[] = [];
	const companyMap = new Map(companies.map((c) => [c.slug, c]));

	for (const [slug, leverJobs] of companyJobs) {
		const company = companyMap.get(slug);
		if (!company) continue;

		// Limit jobs processed per company for performance
		const jobsToProcess = leverJobs.slice(0, MAX_RESULTS_PER_COMPANY);

		for (const job of jobsToProcess) {
			const { matches, isRemote } = matchesSearchParams(job, params);

			if (matches) {
				jobs.push(convertToJobResult(job, company.name, isRemote));
			}
		}
	}

	// Sort by posted date (newest first) and limit total results
	return jobs
		.sort((a, b) => {
			const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
			const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
			return dateB - dateA;
		})
		.slice(0, 100); // Increased from 20 to 100 max results
}

/**
 * Clear the job cache (useful for testing or forcing refresh)
 */
export function clearLeverCache(): void {
	jobCache.clear();
}

/**
 * Get cache statistics
 */
export function getLeverCacheStats(): { size: number; companies: string[] } {
	return {
		size: jobCache.size,
		companies: Array.from(jobCache.keys())
	};
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
