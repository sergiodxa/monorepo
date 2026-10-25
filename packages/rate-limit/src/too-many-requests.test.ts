/**
 * Tests the denial response builder: the quota fields ship on every response it
 * makes, while the status is all it fixes about the rest — the body and its media
 * type stay the caller's, so a limited surface answers HTML as easily as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RateLimitPolicy } from "./headers.js";
import type { RateLimitDecision } from "./types.js";

import { QUOTA_EXCEEDED_TYPE, quotaExceeded, tooManyRequests } from "./too-many-requests.js";

/** A ten-second policy under the default name. */
const POLICY: RateLimitPolicy = { window: "10 seconds" };

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
		let response = tooManyRequests(denied(), POLICY);

		expect(response.status).toBe(429);
		expect(response.statusText).toBe("Too Many Requests");
	});

	test("carries the quota fields on a bodiless response", () => {
		let response = tooManyRequests(denied(), POLICY);

		expect(response.headers.get("RateLimit")).toBe('"default";r=0;t=7');
		expect(response.headers.get("RateLimit-Policy")).toBe('"default";q=10;w=10');
		expect(response.headers.get("Retry-After")).toBe("7");
	});

	test("carries them alongside a JSON body the caller labelled", async () => {
		let response = tooManyRequests(
			denied(),
			POLICY,
			JSON.stringify({ error: "too_many_requests" }),
			{ headers: { "Content-Type": "application/json" } },
		);

		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(response.headers.get("RateLimit")).toBe('"default";r=0;t=7');
		await expect(response.json()).resolves.toEqual({ error: "too_many_requests" });
	});

	test("carries them alongside HTML just the same", async () => {
		let response = tooManyRequests(denied(), POLICY, "<h1>Slow down</h1>", {
			headers: { "Content-Type": "text/html" },
		});

		expect(response.headers.get("Content-Type")).toBe("text/html");
		expect(response.headers.get("Retry-After")).toBe("7");
		await expect(response.text()).resolves.toBe("<h1>Slow down</h1>");
	});

	test("adds no media type of its own", () => {
		let response = tooManyRequests(denied(), POLICY);

		expect(response.headers.get("Content-Type")).toBeNull();
	});

	test("keeps the caller's other headers", () => {
		let response = tooManyRequests(denied(), POLICY, null, {
			headers: { "Cache-Control": "no-store" },
		});

		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("RateLimit")).toBe('"default";r=0;t=7');
	});

	test("holds the status against an init that disagrees", () => {
		let response = tooManyRequests(denied(), POLICY, null, { status: 200, statusText: "OK" });

		expect(response.status).toBe(429);
		expect(response.statusText).toBe("Too Many Requests");
	});

	test("ships only the fields the decision supports", () => {
		let response = tooManyRequests(
			denied({ remaining: null, retryAfter: Number.POSITIVE_INFINITY }),
			POLICY,
		);

		expect(response.headers.get("RateLimit")).toBe('"default";r=0');
		expect(response.headers.get("Retry-After")).toBeNull();
	});
});

describe(quotaExceeded.name, () => {
	test("answers the draft's quota-exceeded problem naming the violated policy", async () => {
		let response = quotaExceeded(denied(), { ...POLICY, name: "burst" }, "Wait seven seconds.");

		expect(response.status).toBe(429);
		expect(response.statusText).toBe("Too Many Requests");
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(response.headers.get("RateLimit")).toBe('"burst";r=0;t=7');
		expect(response.headers.get("Retry-After")).toBe("7");
		await expect(response.json()).resolves.toEqual({
			type: QUOTA_EXCEEDED_TYPE,
			title: "Request cannot be satisfied as assigned quota has been exceeded",
			status: 429,
			detail: "Wait seven seconds.",
			"violated-policies": ["burst"],
		});
	});

	test("names the default policy and keeps the caller's headers", async () => {
		let response = quotaExceeded(denied(), POLICY, undefined, {
			headers: { "Cache-Control": "no-store" },
		});

		expect(response.headers.get("Cache-Control")).toBe("no-store");
		await expect(response.json()).resolves.toMatchObject({ "violated-policies": ["default"] });
	});
});
