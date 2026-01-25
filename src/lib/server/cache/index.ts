/**
 * Cache module exports
 *
 * This module provides Redis-based caching for the application,
 * with a focus on job search result caching.
 *
 * Usage:
 *
 * ```typescript
 * import { withJobCache, getCachedJobs, cacheJobs, invalidateJobCache } from '$lib/server/cache';
 *
 * // Option 1: Use the wrapper function (recommended)
 * const jobs = await withJobCache(searchParams, () => searchAdzunaJobs(searchParams));
 *
 * // Option 2: Manual cache management
 * const cached = await getCachedJobs(searchParams);
 * if (!cached) {
 *   const jobs = await searchAdzunaJobs(searchParams);
 *   await cacheJobs(searchParams, jobs);
 * }
 *
 * // Invalidate cache
 * await invalidateJobCache(); // All job cache
 * await invalidateJobCache('abc*'); // Pattern match
 * ```
 */

// Redis client utilities
export {
	getRedis,
	isRedisConfigured,
	withCache,
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheDeletePattern,
	getCacheMetrics,
	resetCacheMetrics,
	type CacheMetrics
} from './redis';

// Job-specific caching
export {
	getCachedJobs,
	cacheJobs,
	invalidateJobCache,
	withJobCache,
	getCachedJobData,
	getJobCacheStats,
	prewarmJobCache,
	type CachedJobData,
	type JobCacheStats
} from './job-cache';
