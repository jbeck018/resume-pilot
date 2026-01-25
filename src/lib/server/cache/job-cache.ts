/**
 * Job cache service for caching job search results
 *
 * Features:
 * - Caches job search results by hashed search criteria
 * - Configurable TTL (default 4 hours)
 * - Graceful fallback when Redis is unavailable
 * - Cache invalidation by pattern
 * - Metrics tracking (hits/misses)
 */

import type { JobResult, JobSearchParams } from '$lib/server/jobs/types';
import {
	getRedis,
	isRedisConfigured,
	withCache,
	cacheGet,
	cacheSet,
	cacheDeletePattern,
	recordCacheHit,
	recordCacheMiss,
	getCacheMetrics as getBaseCacheMetrics,
	type CacheMetrics
} from './redis';

// Cache key prefix for job searches
const JOB_CACHE_PREFIX = 'job-cache';

// Default TTL: 4 hours (14400 seconds)
const DEFAULT_TTL_SECONDS = 14400;

/**
 * Cached job data structure with metadata
 */
export interface CachedJobData {
	jobs: JobResult[];
	cachedAt: string;
	expiresAt: string;
	sourceCounts: Record<string, number>;
	searchParams: JobSearchParams;
}

/**
 * Job cache statistics
 */
export interface JobCacheStats extends CacheMetrics {
	isConfigured: boolean;
	prefix: string;
	defaultTtlSeconds: number;
}

/**
 * Generate a deterministic hash for search parameters
 * Uses a simple string concatenation approach for consistency
 */
function hashSearchParams(params: JobSearchParams): string {
	const normalized = {
		roles: [...(params.roles || [])].sort(),
		locations: [...(params.locations || [])].sort(),
		skills: [...(params.skills || [])].sort(),
		remotePreference: params.remotePreference || '',
		salaryMin: params.salaryMin || 0,
		salaryMax: params.salaryMax || 0
	};

	// Create a deterministic string representation
	const str = JSON.stringify(normalized);

	// Simple hash function (djb2)
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}

	// Convert to base36 for shorter key
	return Math.abs(hash).toString(36);
}

/**
 * Generate cache key for job search
 */
function getCacheKey(params: JobSearchParams): string {
	const hash = hashSearchParams(params);
	return `${JOB_CACHE_PREFIX}:${hash}`;
}

/**
 * Get cached jobs for the given search criteria
 *
 * @param criteria - Job search parameters
 * @returns Cached jobs or null if not in cache
 */
export async function getCachedJobs(criteria: JobSearchParams): Promise<JobResult[] | null> {
	if (!isRedisConfigured()) {
		return null;
	}

	const key = getCacheKey(criteria);
	const cached = await cacheGet<CachedJobData>(key);

	if (cached) {
		// Validate the cached data structure
		if (cached.jobs && Array.isArray(cached.jobs)) {
			console.log(`Job cache hit for key ${key}: ${cached.jobs.length} jobs`);
			return cached.jobs;
		}
	}

	console.log(`Job cache miss for key ${key}`);
	return null;
}

/**
 * Cache job search results
 *
 * @param criteria - Job search parameters used for the search
 * @param jobs - Job results to cache
 * @param ttlSeconds - Time-to-live in seconds (default: 4 hours)
 */
export async function cacheJobs(
	criteria: JobSearchParams,
	jobs: JobResult[],
	ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
	if (!isRedisConfigured()) {
		return;
	}

	const key = getCacheKey(criteria);
	const now = new Date();

	// Count jobs by source
	const sourceCounts: Record<string, number> = {};
	for (const job of jobs) {
		sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
	}

	const cacheData: CachedJobData = {
		jobs,
		cachedAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
		sourceCounts,
		searchParams: criteria
	};

	await cacheSet(key, cacheData, ttlSeconds);
	console.log(`Cached ${jobs.length} jobs with key ${key}, TTL: ${ttlSeconds}s`);
}

/**
 * Invalidate job cache entries
 *
 * @param pattern - Optional pattern to match keys (default: all job cache entries)
 * @returns Number of keys deleted
 */
export async function invalidateJobCache(pattern?: string): Promise<number> {
	if (!isRedisConfigured()) {
		return 0;
	}

	const fullPattern = pattern ? `${JOB_CACHE_PREFIX}:${pattern}` : `${JOB_CACHE_PREFIX}:*`;
	const deleted = await cacheDeletePattern(fullPattern);
	console.log(`Invalidated ${deleted} job cache entries matching ${fullPattern}`);
	return deleted;
}

/**
 * Wrapper function for job source searches with caching
 *
 * @param criteria - Job search parameters
 * @param fetcher - Function to fetch jobs from the API
 * @param ttlSeconds - Cache TTL in seconds (default: 4 hours)
 * @returns Job results (from cache or freshly fetched)
 */
export async function withJobCache(
	criteria: JobSearchParams,
	fetcher: () => Promise<JobResult[]>,
	ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<JobResult[]> {
	const key = getCacheKey(criteria);

	return withCache(
		key,
		async () => {
			const jobs = await fetcher();

			// Store metadata for the cached entry
			const now = new Date();
			const sourceCounts: Record<string, number> = {};
			for (const job of jobs) {
				sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
			}

			// Note: withCache will store the jobs, but we return only the jobs array
			// The metadata is useful for debugging but not needed by callers
			return jobs;
		},
		ttlSeconds
	);
}

/**
 * Get cached job data with metadata
 *
 * @param criteria - Job search parameters
 * @returns Full cached data including metadata, or null
 */
export async function getCachedJobData(criteria: JobSearchParams): Promise<CachedJobData | null> {
	if (!isRedisConfigured()) {
		return null;
	}

	const key = getCacheKey(criteria);
	return cacheGet<CachedJobData>(key);
}

/**
 * Get job cache statistics
 */
export function getJobCacheStats(): JobCacheStats {
	return {
		...getBaseCacheMetrics(),
		isConfigured: isRedisConfigured(),
		prefix: JOB_CACHE_PREFIX,
		defaultTtlSeconds: DEFAULT_TTL_SECONDS
	};
}

/**
 * Pre-warm the cache with common search criteria
 * Useful for warming up cache after deployment
 *
 * @param criteriaList - List of search criteria to pre-warm
 * @param fetcherFactory - Function that returns a fetcher for given criteria
 */
export async function prewarmJobCache(
	criteriaList: JobSearchParams[],
	fetcherFactory: (criteria: JobSearchParams) => () => Promise<JobResult[]>
): Promise<{ warmed: number; failed: number }> {
	let warmed = 0;
	let failed = 0;

	for (const criteria of criteriaList) {
		try {
			const fetcher = fetcherFactory(criteria);
			await withJobCache(criteria, fetcher);
			warmed++;
		} catch (error) {
			console.error('Failed to pre-warm cache for criteria:', criteria, error);
			failed++;
		}
	}

	return { warmed, failed };
}
