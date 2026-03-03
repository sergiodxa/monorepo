/**
 * Per-user rate limiting for authentication endpoints.
 * Uses in-memory storage with TTL-based expiration.
 * This is used within Durable Objects where central rate limiters aren't available.
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

// In-memory cache - persists across requests within the same DO instance
let cache = new Map<string, RateLimitEntry>();

// Cleanup stale entries periodically
let lastCleanup = 0;
let CLEANUP_INTERVAL = 60_000; // 1 minute

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

interface RateLimitConfig {
	/** Maximum number of requests allowed in the window */
	maxRequests: number;
	/** Time window in milliseconds */
	windowMs: number;
}

interface RateLimitResult {
	success: boolean;
	remaining: number;
	resetAt: number;
}

/**
 * Check if an action should be rate limited for a given identifier (e.g., email).
 * Uses sliding window rate limiting.
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

	// If no entry or entry has expired, create new one
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

	// Increment count
	entry.count++;

	// Check if over limit
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

// Default configurations for different actions
export let USER_RATE_LIMITS = {
	// Authentication attempts: 5 per minute per email
	authOptions: { maxRequests: 5, windowMs: 60_000 },
	authVerify: { maxRequests: 5, windowMs: 60_000 },
	// Registration: 3 per 5 minutes per email (more strict)
	registerOptions: { maxRequests: 3, windowMs: 300_000 },
	registerVerify: { maxRequests: 3, windowMs: 300_000 },
} as const;

/**
 * Clear rate limit cache (useful for testing)
 */
export function clearUserRateLimitCache() {
	cache.clear();
}
