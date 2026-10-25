/**
 * Tests the exact bytes the IETF draft fields carry, keeping output limited
 * to what the backend can truthfully report — the reason `remaining`
 * disappears for a binding-backed limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RateLimitPolicy } from "./headers.js";
import type { RateLimitDecision } from "./types.js";

import { applyRateLimitHeaders, rateLimitHeaders } from "./headers.js";

/** A ten-second policy under the default name. */
const POLICY: RateLimitPolicy = { window: "10 seconds" };

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
	test("writes both fields as draft-11 Lists of named policy Items, never the draft-07 Dictionary", () => {
		let entries = rateLimitHeaders(decision({ allowed: false, remaining: 0 }), POLICY);

		expect(entries).toEqual([
			["RateLimit", '"default";r=0;t=7'],
			["RateLimit-Policy", '"default";q=10;w=10'],
			["Retry-After", "7"],
		]);
	});

	test("omits Retry-After on an allowed response", () => {
		let entries = rateLimitHeaders(decision(), POLICY);

		expect(entries).toEqual([
			["RateLimit", '"default";r=4;t=7'],
			["RateLimit-Policy", '"default";q=10;w=10'],
		]);
	});

	test("names the policy in both fields", () => {
		let entries = rateLimitHeaders(decision(), { ...POLICY, name: "burst" });

		expect(entries).toEqual([
			["RateLimit", '"burst";r=4;t=7'],
			["RateLimit-Policy", '"burst";q=10;w=10'],
		]);
	});

	test("writes the quota unit and the partition key", () => {
		let entries = rateLimitHeaders(decision(), {
			...POLICY,
			quotaUnit: "content-bytes",
			partitionKey: new TextEncoder().encode("trial121323"),
		});

		expect(entries).toEqual([
			["RateLimit", '"default";r=4;t=7;pk=:dHJpYWwxMjEzMjM=:'],
			["RateLimit-Policy", '"default";q=10;qu="content-bytes";w=10;pk=:dHJpYWwxMjEzMjM=:'],
		]);
	});

	test("reports an exhausted budget on a denial the backend cannot count", () => {
		let entries = rateLimitHeaders(decision({ allowed: false, remaining: null }), POLICY);

		expect(entries).toContainEqual(["RateLimit", '"default";r=0;t=7']);
	});

	test("omits RateLimit when an allowed request's remaining quota is unknown", () => {
		let entries = rateLimitHeaders(decision({ remaining: null }), POLICY);

		expect(entries).toEqual([["RateLimit-Policy", '"default";q=10;w=10']]);
	});

	test("states the policy window in seconds whatever unit it was configured in", () => {
		let entries = rateLimitHeaders(decision({ limit: 100 }), { window: "1 minute" });

		expect(entries).toContainEqual(["RateLimit-Policy", '"default";q=100;w=60']);
	});

	test("omits the window when it rounds to less than a second", () => {
		let entries = rateLimitHeaders(decision(), { window: 250 });

		expect(entries).toContainEqual(["RateLimit-Policy", '"default";q=10']);
	});

	test("omits every field it cannot compute", () => {
		let entries = rateLimitHeaders(
			decision({ limit: Number.NaN, remaining: null, retryAfter: Number.NaN }),
			{ window: 250 },
		);

		expect(entries).toEqual([]);
	});

	test("keeps a number within 15 digits byte-for-byte", () => {
		let entries = rateLimitHeaders(
			decision({ limit: 999_999_999_999_999, remaining: 0, retryAfter: 3600 }),
			{ window: "1 day" },
		);

		expect(entries).toEqual([
			["RateLimit", '"default";r=0;t=3600'],
			["RateLimit-Policy", '"default";q=999999999999999;w=86400'],
		]);
	});

	test("omits a field whose Integer has no structured field representation", () => {
		let entries = rateLimitHeaders(
			decision({ allowed: false, limit: 10_000_000_000_000_000 }),
			POLICY,
		);

		expect(entries.map(([name]) => name)).toEqual(["RateLimit", "Retry-After"]);
	});

	test("omits both fields when the policy name is not an sf-string", () => {
		let entries = rateLimitHeaders(decision({ allowed: false }), { ...POLICY, name: "ü" });

		expect(entries).toEqual([["Retry-After", "7"]]);
	});
});

describe("applyRateLimitHeaders", () => {
	test("writes the fields onto the response", () => {
		let response = applyRateLimitHeaders(
			new Response("ok"),
			decision({ allowed: false, remaining: 0 }),
			POLICY,
		);

		expect(response.headers.get("RateLimit")).toBe('"default";r=0;t=7');
		expect(response.headers.get("RateLimit-Policy")).toBe('"default";q=10;w=10');
		expect(response.headers.get("Retry-After")).toBe("7");
	});

	test("keeps the response's own headers, status, and body", async () => {
		let original = new Response("body", {
			status: 201,
			headers: { "Content-Type": "text/plain", "X-Trace": "abc" },
		});

		let response = applyRateLimitHeaders(original, decision(), POLICY);

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

		let response = applyRateLimitHeaders(original, decision(), POLICY);

		expect(response).not.toBe(original);
		expect(response.status).toBe(302);
		expect(response.headers.get("RateLimit")).toBe('"default";r=4;t=7');
		expect(await response.text()).toBe("immutable body");
	});

	test("returns the response untouched when there is nothing truthful to say", () => {
		let original = new Response("ok");

		let response = applyRateLimitHeaders(
			original,
			decision({ limit: Number.NaN, remaining: null, retryAfter: Number.NaN }),
			{ window: 250 },
		);

		expect(response).toBe(original);
		expect(response.headers.get("RateLimit")).toBeNull();
	});

	test("keeps other policies' Items and replaces an earlier Item of the same name", () => {
		let original = new Response("ok", {
			headers: {
				RateLimit: '"daily";r=900;t=3600, "default";r=9;t=8',
				"RateLimit-Policy": '"daily";q=1000;w=86400',
			},
		});

		let response = applyRateLimitHeaders(original, decision(), POLICY);

		expect(response.headers.get("RateLimit")).toBe('"daily";r=900;t=3600, "default";r=4;t=7');
		expect(response.headers.get("RateLimit-Policy")).toBe(
			'"daily";q=1000;w=86400, "default";q=10;w=10',
		);
	});

	test("replaces an existing field it cannot parse", () => {
		let original = new Response("ok", { headers: { RateLimit: "limit=10, remaining=0" } });

		let response = applyRateLimitHeaders(original, decision(), POLICY);

		expect(response.headers.get("RateLimit")).toBe('"default";r=4;t=7');
	});

	test("keeps the longer of two Retry-After waits", () => {
		let longer = new Response("ok", { headers: { "Retry-After": "60" } });
		let shorter = new Response("ok", { headers: { "Retry-After": "3" } });
		let denied = decision({ allowed: false, remaining: 0 });

		expect(applyRateLimitHeaders(longer, denied, POLICY).headers.get("Retry-After")).toBe("60");
		expect(applyRateLimitHeaders(shorter, denied, POLICY).headers.get("Retry-After")).toBe("7");
	});
});
