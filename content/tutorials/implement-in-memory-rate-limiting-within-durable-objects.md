---
title: How to Implement In-Memory Rate Limiting Within Durable Objects
excerpt: Build per-user rate limits using a Map inside a Durable Object with automatic cleanup.
tech: "@cloudflare/workers-types@4.0.0"
---

When building authentication systems on Cloudflare Workers, you need to protect endpoints from abuse. Login attempts, registration flows, and password resets are common targets for brute force attacks. While Cloudflare offers built-in rate limiting at the edge, Durable Objects present a unique challenge: they run in isolation, and you cannot easily integrate external rate limiters into their execution context.

The solution is to implement rate limiting directly inside the Durable Object using in-memory storage. Since Durable Objects maintain state across requests (as long as the instance stays active), a simple `Map` becomes a surprisingly effective rate limit store. Let's build a fixed window rate limiter that supports per-user, per-action limits with automatic cleanup of expired entries.

## Define the Data Structures

Before implementing the rate limiter, we need types for rate limit entries and configuration. The fixed window algorithm divides time into fixed windows (for example, one minute) and counts requests within each window.

```ts {% path="lib/user-rate-limit.ts" %}
/**
 * A single rate limit entry tracking request count and window expiration.
 */
interface RateLimitEntry {
	count: number;
	resetAt: number;
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
```

The `RateLimitEntry` stores the request count and when the window expires. The `RateLimitConfig` defines the limit parameters, and `RateLimitResult` provides all the information you need to either allow the request or return appropriate rate limit headers.

## Create the In-Memory Cache

The cache lives at the module level, outside any function. This is critical because Durable Objects maintain module state across requests as long as the instance stays active.

```ts {% path="lib/user-rate-limit.ts" %}
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
```

Using module-level variables means the cache persists between requests to the same Durable Object instance. The `lastCleanup` timestamp tracks when you last removed expired entries, and `CLEANUP_INTERVAL` controls how often cleanup runs.

## Implement Automatic Cleanup

Without cleanup, the cache would grow unbounded as users make requests. The cleanup function removes expired entries, but it does not run on every request because that would be wasteful.

```ts {% path="lib/user-rate-limit.ts" %}
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
```

The function first checks if enough time has passed since the last cleanup. If not, it returns immediately. This throttling ensures cleanup runs at most once per minute, regardless of request volume. When cleanup does run, it iterates through all entries and removes any where `resetAt` is in the past.

This approach has a nice property: high-traffic Durable Objects clean up frequently (once per minute), while idle instances do not waste cycles. The cache naturally stays bounded to approximately one minute's worth of active rate limit entries.

## Build the Rate Limit Check Function

Now for the core logic. The `checkUserRateLimit` function combines the identifier and action into a cache key, checks the current state, and returns whether the request should be allowed.

```ts {% path="lib/user-rate-limit.ts" %}
/**
 * Checks if an action should be rate limited for a given identifier.
 * Uses fixed window rate limiting.
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

	// No entry or expired window: start fresh
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

	// Increment the counter
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
```

The function starts by calling `cleanup()` to potentially remove expired entries. Then it builds a cache key by combining the action and lowercase identifier. Lowercasing ensures that `user@example.com` and `User@Example.com` are treated as the same identifier.

If there is no existing entry, or if the existing entry's window has expired, you create a new entry starting at count 1. The `resetAt` is set to the current time plus the window duration.

If an entry exists and has not expired, you increment the counter and check if it exceeds the limit. The function always returns a `RateLimitResult` with the current state, which lets you include rate limit headers in your response.

## Define Default Rate Limits

Different actions deserve different limits. Authentication attempts might allow 5 per minute, while registration (a less frequent action) might be more restrictive.

```ts {% path="lib/user-rate-limit.ts" %}
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
```

Using `as const` preserves the literal types, which helps TypeScript understand these are fixed configuration objects rather than mutable values.

## Add a Cache Clear Function for Testing

During testing, you need to reset the rate limit state between test cases.

```ts {% path="lib/user-rate-limit.ts" %}
/**
 * Clears the rate limit cache.
 * Useful for testing.
 */
export function clearUserRateLimitCache() {
	cache.clear();
}
```

This simple function clears all entries, giving you a clean slate for each test.

## Use the Rate Limiter in Your Endpoints

Here is how you might use this rate limiter in an authentication endpoint inside a Durable Object.

```ts {% path="lib/auth-do.ts" %}
import { checkUserRateLimit, USER_RATE_LIMITS } from "./user-rate-limit";

export class AuthDurableObject {
	async handleAuthOptions(email: string): Promise<Response> {
		let rateLimit = checkUserRateLimit(email, "authOptions", USER_RATE_LIMITS.authOptions);

		if (!rateLimit.success) {
			return new Response("Too many requests", {
				status: 429,
				headers: {
					"Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": String(rateLimit.resetAt),
				},
			});
		}

		// Proceed with authentication logic
		let response = await this.generateAuthOptions(email);

		return new Response(JSON.stringify(response), {
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": String(rateLimit.remaining),
				"X-RateLimit-Reset": String(rateLimit.resetAt),
			},
		});
	}
}
```

When the rate limit is exceeded, return a 429 response with a `Retry-After` header indicating how many seconds until the window resets. Include rate limit headers in successful responses too, so clients can implement proactive throttling.

## Handle Multiple Actions for the Same User

Because the cache key includes both the action and identifier, you can rate limit different actions independently.

```ts {% path="lib/auth-do.ts" %}
export class AuthDurableObject {
	async handleRequest(request: Request): Promise<Response> {
		let url = new URL(request.url);
		let email = url.searchParams.get("email");

		if (!email) {
			return new Response("Email required", { status: 400 });
		}

		// Each action has its own rate limit counter
		if (url.pathname === "/auth/options") {
			return this.handleWithRateLimit(email, "authOptions", USER_RATE_LIMITS.authOptions);
		}

		if (url.pathname === "/auth/verify") {
			return this.handleWithRateLimit(email, "authVerify", USER_RATE_LIMITS.authVerify);
		}

		if (url.pathname === "/register/options") {
			return this.handleWithRateLimit(email, "registerOptions", USER_RATE_LIMITS.registerOptions);
		}

		return new Response("Not found", { status: 404 });
	}

	private async handleWithRateLimit(
		email: string,
		action: keyof typeof USER_RATE_LIMITS,
		config: (typeof USER_RATE_LIMITS)[keyof typeof USER_RATE_LIMITS],
	): Promise<Response> {
		let rateLimit = checkUserRateLimit(email, action, config);

		if (!rateLimit.success) {
			return new Response("Too many requests", { status: 429 });
		}

		// Action-specific logic here
		return new Response("OK");
	}
}
```

A user who exhausts their `authOptions` limit can still attempt `registerOptions` because they are tracked separately. This granularity prevents one action's rate limit from blocking unrelated functionality.

## Write Tests for the Rate Limiter

Write tests to verify the rate limiting behavior.

```ts {% path="lib/user-rate-limit.test.ts" %}
import { describe, expect, it, beforeEach } from "bun:test";
import { checkUserRateLimit, clearUserRateLimitCache } from "./user-rate-limit";

describe("checkUserRateLimit", () => {
	beforeEach(() => {
		clearUserRateLimitCache();
	});

	it("allows requests under the limit", () => {
		let config = { maxRequests: 3, windowMs: 60_000 };

		let result1 = checkUserRateLimit("user@example.com", "test", config);
		expect(result1.success).toBe(true);
		expect(result1.remaining).toBe(2);

		let result2 = checkUserRateLimit("user@example.com", "test", config);
		expect(result2.success).toBe(true);
		expect(result2.remaining).toBe(1);

		let result3 = checkUserRateLimit("user@example.com", "test", config);
		expect(result3.success).toBe(true);
		expect(result3.remaining).toBe(0);
	});

	it("blocks requests over the limit", () => {
		let config = { maxRequests: 2, windowMs: 60_000 };

		checkUserRateLimit("user@example.com", "test", config);
		checkUserRateLimit("user@example.com", "test", config);

		let result = checkUserRateLimit("user@example.com", "test", config);
		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it("tracks different actions separately", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };

		let result1 = checkUserRateLimit("user@example.com", "action1", config);
		expect(result1.success).toBe(true);

		let result2 = checkUserRateLimit("user@example.com", "action2", config);
		expect(result2.success).toBe(true);
	});

	it("normalizes email case", () => {
		let config = { maxRequests: 2, windowMs: 60_000 };

		checkUserRateLimit("User@Example.com", "test", config);
		let result = checkUserRateLimit("user@example.com", "test", config);

		expect(result.remaining).toBe(0);
	});
});
```

These tests verify the core behaviors: counting requests, blocking when over limit, separating actions, and normalizing identifiers.

## Memory Considerations

In-memory rate limiting works well because Durable Objects are designed for exactly this kind of stateful coordination. However, keep a few things in mind.

The cache persists only while the Durable Object instance is active. If Cloudflare evicts the instance due to inactivity, the cache is lost. This is actually a feature for rate limiting: if a user has not made requests in a while, their rate limit counters reset naturally.

Memory usage scales with the number of unique identifier/action combinations in your cleanup interval. With a 1 minute cleanup interval and 5 requests per minute limit, you store at most one entry per active user per action. Each entry is small (a string key plus two numbers), so even thousands of active users use minimal memory.

For extremely high-traffic Durable Objects, you could reduce `CLEANUP_INTERVAL` to clean up more frequently, or implement a maximum cache size with LRU eviction. In practice, the default configuration handles most authentication workloads without issues.

## When to Use This Pattern

In-memory rate limiting inside Durable Objects works best when you need per-user limits that are coordinated within a single Durable Object instance. This pattern is ideal for authentication flows where you route all requests for a given user to the same Durable Object.

For global rate limiting across all Workers instances, consider Cloudflare's built-in rate limiting or a distributed solution using Workers KV or Durable Objects with coordination. For more complex rate limiting needs like sliding windows or token buckets, you can extend this pattern or use a dedicated rate limiting service.

The simplicity of in-memory storage with automatic cleanup makes this approach easy to understand, test, and maintain. It handles the common case of protecting authentication endpoints from brute force attacks without adding external dependencies or complexity.
