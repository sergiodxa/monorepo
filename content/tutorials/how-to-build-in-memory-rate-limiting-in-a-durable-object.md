---
title: How to Build In-Memory Rate Limiting in a Durable Object
excerpt: Build a fixed window rate limiter inside a Durable Object and return HTTP 429 responses with headers.
tech: "@cloudflare/workers-types@4.0.0"
---

Authentication endpoints usually need request limits. Login, registration, and verification routes are common brute force targets, and a Durable Object is often the place where those requests already converge.

This tutorial builds a fixed window rate limiter that lives in memory inside a Durable Object. You will store counters in a `Map`, clean up expired entries, and return HTTP 429 (Too Many Requests) responses with useful headers.

## Create the Rate Limit Module

```ts {% path="lib/user-rate-limit.ts" %}
interface RateLimitEntry {
	count: number;
	resetAt: number;
}

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

interface RateLimitResult {
	success: boolean;
	remaining: number;
	resetAt: number;
}

let cache = new Map<string, RateLimitEntry>();
let lastCleanup = 0;
let CLEANUP_INTERVAL = 60_000;

export let USER_RATE_LIMITS = {
	authOptions: { maxRequests: 5, windowMs: 60_000 },
	authVerify: { maxRequests: 5, windowMs: 60_000 },
	registerOptions: { maxRequests: 3, windowMs: 300_000 },
	registerVerify: { maxRequests: 3, windowMs: 300_000 },
} as const;

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

export function clearUserRateLimitCache() {
	cache.clear();
	lastCleanup = 0;
}
```

This file keeps all rate limit state in module memory. That works well inside a Durable Object because the instance keeps module state while it stays active.

The limiter uses a fixed window per `action` and `identifier`. Cleanup runs opportunistically, so idle instances do not spend time deleting expired entries.

## Add the Durable Object Handler

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

		let response = await this.generateAuthOptions(email);

		return new Response(JSON.stringify(response), {
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": String(rateLimit.remaining),
				"X-RateLimit-Reset": String(rateLimit.resetAt),
			},
		});
	}

	private async generateAuthOptions(email: string) {
		return {
			email,
			challenge: "challenge-value",
		};
	}
}
```

Start by protecting one handler. This keeps the first integration small, and it shows the two important outputs: a normal JSON response and an HTTP 429 (Too Many Requests) response.

The response headers expose the current window state. Clients can use them to back off before they hit the limit again.

## Route Multiple Actions

```ts {% path="lib/auth-do.ts" %}
import { checkUserRateLimit, USER_RATE_LIMITS } from "./user-rate-limit";

export class AuthDurableObject {
	async handleRequest(request: Request): Promise<Response> {
		let url = new URL(request.url);
		let email = url.searchParams.get("email");

		if (!email) {
			return new Response("Email required", { status: 400 });
		}

		if (url.pathname === "/auth/options") {
			return this.handleWithRateLimit(email, "authOptions", USER_RATE_LIMITS.authOptions);
		}

		if (url.pathname === "/auth/verify") {
			return this.handleWithRateLimit(email, "authVerify", USER_RATE_LIMITS.authVerify);
		}

		if (url.pathname === "/register/options") {
			return this.handleWithRateLimit(email, "registerOptions", USER_RATE_LIMITS.registerOptions);
		}

		if (url.pathname === "/register/verify") {
			return this.handleWithRateLimit(email, "registerVerify", USER_RATE_LIMITS.registerVerify);
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
			return new Response("Too many requests", {
				status: 429,
				headers: {
					"Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": String(rateLimit.resetAt),
				},
			});
		}

		let response = await this.runAction(action, email);

		return new Response(JSON.stringify(response), {
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": String(rateLimit.remaining),
				"X-RateLimit-Reset": String(rateLimit.resetAt),
			},
		});
	}

	private async runAction(action: keyof typeof USER_RATE_LIMITS, email: string) {
		if (action === "authOptions") {
			return { email, challenge: "challenge-value" };
		}

		if (action === "authVerify") {
			return { email, verified: true };
		}

		if (action === "registerOptions") {
			return { email, registration: "options" };
		}

		return { email, registered: true };
	}
}
```

Now the same limiter protects several actions without sharing one counter. A user can exhaust `authOptions` and still call `registerOptions`, because the cache key includes both the action and the identifier.

This is the main reason to keep the key format explicit. It gives you per-action control without extra storage layers.

## Test the Rate Limiter

```ts {% path="lib/user-rate-limit.test.ts" %}
import { beforeEach, describe, expect, it } from "bun:test";
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

	it("tracks actions separately", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };

		let authResult = checkUserRateLimit("user@example.com", "auth", config);
		expect(authResult.success).toBe(true);

		let registerResult = checkUserRateLimit("user@example.com", "register", config);
		expect(registerResult.success).toBe(true);
	});

	it("normalizes identifier case", () => {
		let config = { maxRequests: 2, windowMs: 60_000 };

		checkUserRateLimit("User@Example.com", "test", config);
		let result = checkUserRateLimit("user@example.com", "test", config);

		expect(result.remaining).toBe(0);
	});
});
```

These tests cover the behavior that usually breaks first: counting, blocking, action isolation, and identifier normalization. The cache reset helper keeps each test independent.

## Final Thoughts

This pattern fits Durable Objects well because requests for the same entity already converge on one instance. You get simple per-user and per-action limits, but the trade-off is that counters disappear when the object is evicted from memory.

You can extend this further with different window sizes, route-specific limits, or a different algorithm such as a sliding window.
