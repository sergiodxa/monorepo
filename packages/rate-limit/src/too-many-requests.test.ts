/**
 * Tests the denial response builder: the quota fields ship on every response it
 * makes, while the status is all it fixes about the rest — the body and its media
 * type stay the caller's, so a limited surface answers HTML as easily as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RateLimitDecision } from "./types.js";

import { tooManyRequests } from "./too-many-requests.js";

/** Builds a denial, overriding only the fields a case cares about. */
function denied(overrides: Partial<RateLimitDecision> = {}): RateLimitDecision {
	return {
		allowed: false,
		limit: 10,
		remaining: 0,
		reset: new Date(1_000_010_000),
		retryAfter: 7,
		...overrides,
	};
}

describe(tooManyRequests.name, () => {
	test("answers 429 with the standard reason phrase", () => {
		let response = tooManyRequests(denied(), "10 seconds");

		expect(response.status).toBe(429);
		expect(response.statusText).toBe("Too Many Requests");
	});

	test("carries the quota fields on a bodiless response", () => {
		let response = tooManyRequests(denied(), "10 seconds");

		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=0, reset=7");
		expect(response.headers.get("RateLimit-Policy")).toBe("10;w=10");
		expect(response.headers.get("Retry-After")).toBe("7");
	});

	test("carries them alongside a JSON body the caller labelled", async () => {
		let response = tooManyRequests(
			denied(),
			"10 seconds",
			JSON.stringify({ error: "too_many_requests" }),
			{ headers: { "Content-Type": "application/json" } },
		);

		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=0, reset=7");
		await expect(response.json()).resolves.toEqual({ error: "too_many_requests" });
	});

	test("carries them alongside HTML just the same", async () => {
		let response = tooManyRequests(denied(), "10 seconds", "<h1>Slow down</h1>", {
			headers: { "Content-Type": "text/html" },
		});

		expect(response.headers.get("Content-Type")).toBe("text/html");
		expect(response.headers.get("Retry-After")).toBe("7");
		await expect(response.text()).resolves.toBe("<h1>Slow down</h1>");
	});

	test("adds no media type of its own", () => {
		let response = tooManyRequests(denied(), "10 seconds");

		expect(response.headers.get("Content-Type")).toBeNull();
	});

	test("keeps the caller's other headers", () => {
		let response = tooManyRequests(denied(), "10 seconds", null, {
			headers: { "Cache-Control": "no-store" },
		});

		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=0, reset=7");
	});

	test("holds the status against an init that disagrees", () => {
		let response = tooManyRequests(denied(), "10 seconds", null, { status: 200, statusText: "OK" });

		expect(response.status).toBe(429);
		expect(response.statusText).toBe("Too Many Requests");
	});

	test("ships only the fields the decision supports", () => {
		let response = tooManyRequests(
			denied({ remaining: null, retryAfter: Number.POSITIVE_INFINITY }),
			"10 seconds",
		);

		expect(response.headers.get("RateLimit")).toBe("limit=10");
		expect(response.headers.get("Retry-After")).toBeNull();
	});
});
