/**
 * Redis client utility for Upstash Redis (serverless-compatible)
 *
 * Required environment variables:
 * - UPSTASH_REDIS_REST_URL: The REST URL from your Upstash Redis database
 * - UPSTASH_REDIS_REST_TOKEN: The REST token from your Upstash Redis database
 *
 * Alternative (for local development):
 * - REDIS_URL: Standard Redis connection URL (redis://...)
 *
 * Upstash is recommended for production as it works with Cloudflare Workers.
 */

import { Redis } from '@upstash/redis';

// Lazy initialization to prevent errors during build
let _redis: Redis | null = null;

/**
 * Configuration for Redis connection
 */
interface RedisConfig {
	url: string;
	token: string;
}

/**
 * Get Redis configuration from environment variables
 */
const getRedisConfig = (): RedisConfig | null => {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (url && token) {
		return { url, token };
	}

	// Fallback: Check for REDIS_URL and try to parse it
	// Note: This won't work with Cloudflare Workers, only for local development
	const redisUrl = process.env.REDIS_URL;
	if (redisUrl) {
		console.warn(
			'REDIS_URL detected but Upstash credentials not found. ' +
				'For production use with Cloudflare Workers, please use Upstash Redis.'
		);
	}

	return null;
};

/**
 * Check if Redis is configured and available
 */
export const isRedisConfigured = (): boolean => {
	return getRedisConfig() !== null;
};

/**
 * Get the Redis client instance (lazy initialization)
 * Returns null if Redis is not configured
 */
export const getRedis = (): Redis | null => {
	if (_redis) {
		return _redis;
	}

	const config = getRedisConfig();
	if (!config) {
		return null;
	}

	try {
		_redis = new Redis({
			url: config.url,
			token: config.token
		});
		return _redis;
	} catch (error) {
		console.error('Failed to initialize Redis client:', error);
		return null;
	}
};

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
	hits: number;
	misses: number;
	errors: number;
	lastReset: Date;
}

// In-memory metrics (reset on server restart)
const metrics: CacheMetrics = {
	hits: 0,
	misses: 0,
	errors: 0,
	lastReset: new Date()
};

/**
 * Get current cache metrics
 */
export const getCacheMetrics = (): CacheMetrics => {
	return { ...metrics };
};

/**
 * Reset cache metrics
 */
export const resetCacheMetrics = (): void => {
	metrics.hits = 0;
	metrics.misses = 0;
	metrics.errors = 0;
	metrics.lastReset = new Date();
};

/**
 * Record a cache hit
 */
export const recordCacheHit = (): void => {
	metrics.hits++;
};

/**
 * Record a cache miss
 */
export const recordCacheMiss = (): void => {
	metrics.misses++;
};

/**
 * Record a cache error
 */
export const recordCacheError = (): void => {
	metrics.errors++;
};

/**
 * Generic cache wrapper function
 * Executes the fetcher function and caches the result, or returns cached data if available
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch data if not in cache
 * @param ttlSeconds - Time-to-live in seconds (default: 4 hours)
 * @returns Cached or freshly fetched data
 */
export async function withCache<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttlSeconds: number = 14400 // 4 hours default
): Promise<T> {
	const redis = getRedis();

	// If Redis is not available, just execute the fetcher
	if (!redis) {
		return fetcher();
	}

	try {
		// Try to get from cache
		const cached = await redis.get<T>(key);

		if (cached !== null) {
			recordCacheHit();
			return cached;
		}

		recordCacheMiss();
	} catch (error) {
		console.error('Redis get error:', error);
		recordCacheError();
		// Continue to fetch fresh data
	}

	// Fetch fresh data
	const data = await fetcher();

	// Store in cache (don't await to not block the response)
	try {
		await redis.setex(key, ttlSeconds, data);
	} catch (error) {
		console.error('Redis set error:', error);
		recordCacheError();
		// Data was still fetched successfully, so return it
	}

	return data;
}

/**
 * Get a value from cache
 *
 * @param key - Cache key
 * @returns Cached value or null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const redis = getRedis();
	if (!redis) return null;

	try {
		const value = await redis.get<T>(key);
		if (value !== null) {
			recordCacheHit();
		} else {
			recordCacheMiss();
		}
		return value;
	} catch (error) {
		console.error('Redis get error:', error);
		recordCacheError();
		return null;
	}
}

/**
 * Set a value in cache
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlSeconds - Time-to-live in seconds
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 14400): Promise<void> {
	const redis = getRedis();
	if (!redis) return;

	try {
		await redis.setex(key, ttlSeconds, value);
	} catch (error) {
		console.error('Redis set error:', error);
		recordCacheError();
	}
}

/**
 * Delete a value from cache
 *
 * @param key - Cache key
 */
export async function cacheDelete(key: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;

	try {
		await redis.del(key);
	} catch (error) {
		console.error('Redis delete error:', error);
		recordCacheError();
	}
}

/**
 * Delete multiple keys matching a pattern
 * Note: Upstash supports SCAN for pattern matching
 *
 * @param pattern - Key pattern (e.g., "job-cache:*")
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
	const redis = getRedis();
	if (!redis) return 0;

	try {
		let deletedCount = 0;
		let cursor = 0;

		// Use SCAN to find matching keys
		do {
			const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
			cursor = Number(nextCursor);

			if (keys.length > 0) {
				await redis.del(...keys);
				deletedCount += keys.length;
			}
		} while (cursor !== 0);

		return deletedCount;
	} catch (error) {
		console.error('Redis delete pattern error:', error);
		recordCacheError();
		return 0;
	}
}
