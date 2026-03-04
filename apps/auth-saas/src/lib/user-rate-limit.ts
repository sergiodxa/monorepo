/**
 * Per-user rate limiting for authentication endpoints.
 * Uses in-memory storage with TTL-based expiration.
 * This is used within Durable Objects where central rate limiters aren't available.
 */

/**
 * A single rate limit entry tracking request count and window expiration.
 */
interface RateLimitEntry {
	count: number;
	resetAt: number;
}

/**
 * In-memory cache - persists across requests within the same DO instance.
 */
let cache = new Map<string, RateLimitEntry>();

/**
 * Timestamp of the last cache cleanup.
 */
let lastCleanup = 0;

/**
 * Interval between cache cleanups in milliseconds (1 minute).
 */
let CLEANUP_INTERVAL = 60_000;

/**
 * Removes expired entries from the cache.
 * Runs at most once per CLEANUP_INTERVAL.
 */
function cleanup() {
	let now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;

	for (let [key, entry] of cache) {
		if (entry.resetAt < now) {
			cache.delete(key);
		}
	}
}

/**
 * Configuration for a rate limit window.
 */
interface RateLimitConfig {
	/** Maximum number of requests allowed in the window */
	maxRequests: number;
	/** Time window in milliseconds */
	windowMs: number;
}

/**
 * Result of a rate limit check.
 */
interface RateLimitResult {
	/** Whether the request is allowed */
	success: boolean;
	/** Number of requests remaining in the window */
	remaining: number;
	/** Timestamp when the window resets */
	resetAt: number;
}

/**
 * Checks if an action should be rate limited for a given identifier.
 * Uses sliding window rate limiting.
 * @param identifier - The identifier to rate limit (e.g., email)
 * @param action - The action being rate limited
 * @param config - The rate limit configuration
 * @returns The rate limit result
 */
export function checkUserRateLimit(
	identifier: string,
	action: string,
	config: RateLimitConfig,
): RateLimitResult {
	cleanup();

	let key = `${action}:${identifier.toLowerCase()}`;
	let now = Date.now();
	let entry = cache.get(key);

	if (!entry || entry.resetAt < now) {
		entry = {
			count: 1,
			resetAt: now + config.windowMs,
		};
		cache.set(key, entry);
		return {
			success: true,
			remaining: config.maxRequests - 1,
			resetAt: entry.resetAt,
		};
	}

	entry.count++;

	if (entry.count > config.maxRequests) {
		return {
			success: false,
			remaining: 0,
			resetAt: entry.resetAt,
		};
	}

	return {
		success: true,
		remaining: config.maxRequests - entry.count,
		resetAt: entry.resetAt,
	};
}

/**
 * Default rate limit configurations for different authentication actions.
 */
export let USER_RATE_LIMITS = {
	/** Authentication attempts: 5 per minute per email */
	authOptions: { maxRequests: 5, windowMs: 60_000 },
	authVerify: { maxRequests: 5, windowMs: 60_000 },
	/** Registration: 3 per 5 minutes per email (more strict) */
	registerOptions: { maxRequests: 3, windowMs: 300_000 },
	registerVerify: { maxRequests: 3, windowMs: 300_000 },
} as const;

/**
 * Clears the rate limit cache.
 * Useful for testing.
 */
export function clearUserRateLimitCache() {
	cache.clear();
}
