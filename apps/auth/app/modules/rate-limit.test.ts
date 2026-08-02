/**
 * Test suite for the rate limiting module. Pins the published
 * `too_many_requests` error contract, checks that the emitted `RateLimit` fields
 * come from the limiter's declared policy rather than a fixed retry hint, and
 * covers the fail-open behavior when a binding cannot answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

/** Whether the fake binding reports the attempt as inside its limit. */
let allowed = true;

/** When set, the fake binding rejects with it instead of answering. */
let bindingError: Error | null = null;

/** Keys the fake binding was asked to count, in call order. */
let countedKeys: string[] = [];

/** Events the module logged, so fail-open can be asserted as observable. */
let loggedEvents: string[] = [];

/**
 * One fake rate limiter binding, standing in for every declared name so a test
 * can drive any limiter through the same switches.
 */
function fakeLimiter() {
	return {
		async limit(options: { key: string }) {
			countedKeys.push(options.key);
			if (bindingError) throw bindingError;
			return { success: allowed };
		},
	};
}

mock.module("~/middleware/cloudflare", () => ({
	bindings: () => ({
		TOKEN_RATE_LIMITER: fakeLimiter(),
		INTROSPECT_RATE_LIMITER: fakeLimiter(),
		REVOKE_RATE_LIMITER: fakeLimiter(),
		AUTHORIZE_RATE_LIMITER: fakeLimiter(),
		LOGIN_RATE_LIMITER: fakeLimiter(),
	}),
}));

mock.module("~/middleware/logger", () => ({
	logger: {
		info: (event: string) => loggedEvents.push(event),
		error: (event: string) => loggedEvents.push(event),
	},
}));

let { rateLimit } = await import("./rate-limit");

/**
 * Thirty seconds into an epoch-aligned minute, so a one-minute window has exactly
 * thirty seconds left and `reset` and `Retry-After` are both predictable.
 */
const HALFWAY_THROUGH_A_MINUTE = new Date("2026-08-01T00:00:30.000Z");

/** Seconds left in the window at {@link HALFWAY_THROUGH_A_MINUTE}. */
const SECONDS_LEFT = 30;

beforeEach(() => {
	allowed = true;
	bindingError = null;
	countedKeys = [];
	loggedEvents = [];
	setSystemTime(HALFWAY_THROUGH_A_MINUTE);
});

afterAll(() => {
	setSystemTime();
});

describe("rateLimit()", () => {
	test("lets an allowed request through and counts it against the given key", async () => {
		let result = await rateLimit("TOKEN_RATE_LIMITER", "client-123");

		expect(result).toBeNull();
		expect(countedKeys).toEqual(["client-123"]);
	});

	test("refuses with the published OAuth error body", async () => {
		allowed = false;

		let response = await rateLimit("TOKEN_RATE_LIMITER", "client-123");

		expect(response).not.toBeNull();
		expect(response?.status).toBe(429);
		expect(await response?.json()).toEqual({
			error: "too_many_requests",
			error_description: "Rate limit exceeded. Please try again later.",
		});
	});

	test("reports the limiter's declared limit and the time actually left", async () => {
		allowed = false;

		let response = await rateLimit("TOKEN_RATE_LIMITER", "client-123");

		expect(response?.headers.get("RateLimit")).toBe(`limit=20, reset=${SECONDS_LEFT}`);
		expect(response?.headers.get("RateLimit-Policy")).toBe("20;w=60");
		expect(response?.headers.get("Retry-After")).toBe(String(SECONDS_LEFT));
	});

	test("reports each limiter's own declared limit", async () => {
		allowed = false;

		let login = await rateLimit("LOGIN_RATE_LIMITER", "203.0.113.4");
		let introspect = await rateLimit("INTROSPECT_RATE_LIMITER", "client-123");

		expect(login?.headers.get("RateLimit-Policy")).toBe("10;w=60");
		expect(introspect?.headers.get("RateLimit-Policy")).toBe("100;w=60");
	});

	test("omits remaining, which the binding never reports", async () => {
		allowed = false;

		let response = await rateLimit("REVOKE_RATE_LIMITER", "client-123");

		expect(response?.headers.get("RateLimit")).not.toContain("remaining");
	});

	test("fails open and logs when the binding cannot answer", async () => {
		bindingError = new Error("binding unavailable");

		let result = await rateLimit("AUTHORIZE_RATE_LIMITER", "203.0.113.4");

		expect(result).toBeNull();
		expect(loggedEvents).toEqual(["rate_limit_unavailable"]);
	});

	test("logs a refused attempt", async () => {
		allowed = false;

		await rateLimit("LOGIN_RATE_LIMITER", "203.0.113.4");

		expect(loggedEvents).toEqual(["rate_limit_exceeded"]);
	});
});
