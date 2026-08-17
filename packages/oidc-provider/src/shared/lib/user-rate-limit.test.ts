import { afterEach, describe, expect, test } from "vitest";

import { checkUserRateLimit, clearUserRateLimitCache, USER_RATE_LIMITS } from "./user-rate-limit";

describe("checkUserRateLimit", () => {
	afterEach(() => {
		clearUserRateLimitCache();
	});

	test("allows requests within limit", () => {
		let config = { maxRequests: 3, windowMs: 60_000 };

		let result1 = checkUserRateLimit("test@example.com", "test", config);
		expect(result1.success).toBe(true);
		expect(result1.remaining).toBe(2);

		let result2 = checkUserRateLimit("test@example.com", "test", config);
		expect(result2.success).toBe(true);
		expect(result2.remaining).toBe(1);

		let result3 = checkUserRateLimit("test@example.com", "test", config);
		expect(result3.success).toBe(true);
		expect(result3.remaining).toBe(0);
	});

	test("blocks requests over limit", () => {
		let config = { maxRequests: 2, windowMs: 60_000 };

		checkUserRateLimit("test@example.com", "test", config);
		checkUserRateLimit("test@example.com", "test", config);

		let result = checkUserRateLimit("test@example.com", "test", config);
		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
	});

	test("tracks different emails separately", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };

		let result1 = checkUserRateLimit("user1@example.com", "test", config);
		expect(result1.success).toBe(true);

		let result2 = checkUserRateLimit("user2@example.com", "test", config);
		expect(result2.success).toBe(true);

		// user1 should be rate limited
		let result3 = checkUserRateLimit("user1@example.com", "test", config);
		expect(result3.success).toBe(false);

		// user2 should also be rate limited
		let result4 = checkUserRateLimit("user2@example.com", "test", config);
		expect(result4.success).toBe(false);
	});

	test("tracks different actions separately", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };

		let result1 = checkUserRateLimit("test@example.com", "action1", config);
		expect(result1.success).toBe(true);

		let result2 = checkUserRateLimit("test@example.com", "action2", config);
		expect(result2.success).toBe(true);

		// action1 should be rate limited
		let result3 = checkUserRateLimit("test@example.com", "action1", config);
		expect(result3.success).toBe(false);

		// action2 should also be rate limited
		let result4 = checkUserRateLimit("test@example.com", "action2", config);
		expect(result4.success).toBe(false);
	});

	test("is case insensitive for email", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };

		checkUserRateLimit("Test@Example.com", "test", config);

		let result = checkUserRateLimit("test@example.com", "test", config);
		expect(result.success).toBe(false);
	});

	test("returns correct resetAt time", () => {
		let config = { maxRequests: 1, windowMs: 60_000 };
		let beforeCheck = Date.now();

		let result = checkUserRateLimit("test@example.com", "test", config);

		expect(result.resetAt).toBeGreaterThanOrEqual(beforeCheck + config.windowMs);
		expect(result.resetAt).toBeLessThanOrEqual(Date.now() + config.windowMs);
	});

	test("default configs are reasonable", () => {
		// Auth attempts: 5 per minute
		expect(USER_RATE_LIMITS.authOptions.maxRequests).toBe(5);
		expect(USER_RATE_LIMITS.authOptions.windowMs).toBe(60_000);

		// Registration: 3 per 5 minutes (more strict)
		expect(USER_RATE_LIMITS.registerOptions.maxRequests).toBe(3);
		expect(USER_RATE_LIMITS.registerOptions.windowMs).toBe(300_000);
	});
});
