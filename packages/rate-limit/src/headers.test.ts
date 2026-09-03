/**
 * Tests the exact bytes the IETF draft fields carry, keeping output limited
 * to what the backend can truthfully report — the reason `remaining`
 * disappears for a binding-backed limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RateLimitDecision } from "./types.js";

import { applyRateLimitHeaders, rateLimitHeaders } from "./headers.js";

/** Builds a decision, overriding only the fields a case cares about. */
function decision(overrides: Partial<RateLimitDecision> = {}): RateLimitDecision {
	return {
		allowed: true,
		limit: 10,
		remaining: 4,
		reset: new Date(1_000_010_000),
		retryAfter: 7,
		...overrides,
	};
}

describe("rateLimitHeaders", () => {
	test("serializes the draft fields for a limited response", () => {
		let entries = rateLimitHeaders(decision({ allowed: false, remaining: 0 }), "10 seconds");

		expect(entries).toEqual([
			["RateLimit", "limit=10, remaining=0, reset=7"],
			["RateLimit-Policy", "10;w=10"],
			["Retry-After", "7"],
		]);
	});

	test("omits Retry-After on an allowed response", () => {
		let entries = rateLimitHeaders(decision(), "10 seconds");

		expect(entries).toEqual([
			["RateLimit", "limit=10, remaining=4, reset=7"],
			["RateLimit-Policy", "10;w=10"],
		]);
	});

	test("omits remaining when the backend cannot report it", () => {
		let entries = rateLimitHeaders(decision({ remaining: null }), "10 seconds");

		expect(entries).toEqual([
			["RateLimit", "limit=10, reset=7"],
			["RateLimit-Policy", "10;w=10"],
		]);
	});

	test("states the policy window in seconds whatever unit it was configured in", () => {
		let entries = rateLimitHeaders(decision({ limit: 100 }), "1 minute");

		expect(entries).toContainEqual(["RateLimit-Policy", "100;w=60"]);
	});

	test("omits the policy when the window rounds to less than a second", () => {
		let entries = rateLimitHeaders(decision(), 250);

		expect(entries.map(([name]) => name)).toEqual(["RateLimit"]);
	});

	test("omits every field it cannot compute", () => {
		let entries = rateLimitHeaders(
			decision({ limit: Number.NaN, remaining: null, retryAfter: Number.NaN }),
			250,
		);

		expect(entries).toEqual([]);
	});
});

describe("applyRateLimitHeaders", () => {
	test("writes the fields onto the response", () => {
		let response = applyRateLimitHeaders(
			new Response("ok"),
			decision({ allowed: false, remaining: 0 }),
			"10 seconds",
		);

		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=0, reset=7");
		expect(response.headers.get("RateLimit-Policy")).toBe("10;w=10");
		expect(response.headers.get("Retry-After")).toBe("7");
	});

	test("keeps the response's own headers, status, and body", async () => {
		let original = new Response("body", {
			status: 201,
			headers: { "Content-Type": "text/plain", "X-Trace": "abc" },
		});

		let response = applyRateLimitHeaders(original, decision(), "10 seconds");

		expect(response.status).toBe(201);
		expect(response.headers.get("X-Trace")).toBe("abc");
		expect(await response.text()).toBe("body");
	});

	test("copies the response when its headers reject mutation", async () => {
		let original = new Response("immutable body", { status: 302 });
		Object.defineProperty(original.headers, "set", {
			value: () => {
				throw new TypeError("immutable");
			},
		});

		let response = applyRateLimitHeaders(original, decision(), "10 seconds");

		expect(response).not.toBe(original);
		expect(response.status).toBe(302);
		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=4, reset=7");
		expect(await response.text()).toBe("immutable body");
	});

	test("returns the response untouched when there is nothing truthful to say", () => {
		let original = new Response("ok");

		let response = applyRateLimitHeaders(
			original,
			decision({ limit: Number.NaN, remaining: null, retryAfter: Number.NaN }),
			250,
		);

		expect(response).toBe(original);
		expect(response.headers.get("RateLimit")).toBeNull();
	});
});
