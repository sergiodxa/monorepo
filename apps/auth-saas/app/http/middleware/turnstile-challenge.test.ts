/**
 * The Turnstile challenge trigger's own threshold math: an address under half
 * its shared budget sees no challenge, one that has spent exactly half does,
 * one well past half still does, and a counter that cannot answer defaults to
 * no challenge. Also drives the middleware itself, confirming it exposes the
 * same answer on the context as `turnstileChallenge`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { shouldChallengeWithTurnstile, turnstileChallenge } from "./turnstile-challenge";

/** A KV namespace double backed by a Map, mirroring the credential class's own tests. */
function memoryKv(): RateLimitKVNamespace {
	let entries = new Map<string, string>();
	return {
		async get(key) {
			return entries.get(key) ?? null;
		},
		async put(key, value) {
			entries.set(key, value);
		},
		async delete(key) {
			entries.delete(key);
		},
	};
}

/** A KV namespace double whose every call throws, standing in for a namespace outage. */
function brokenKv(): RateLimitKVNamespace {
	return {
		async get() {
			throw new Error("kv unavailable");
		},
		async put() {
			throw new Error("kv unavailable");
		},
		async delete() {
			throw new Error("kv unavailable");
		},
	};
}

function requestFrom(ip = "203.0.113.7"): Request {
	return new Request("https://example.com/u/sign-in", { headers: { "CF-Connecting-IP": ip } });
}

describe("shouldChallengeWithTurnstile", () => {
	test("answers false while an address stays under half its shared budget", async () => {
		let kv = memoryKv();

		for (let i = 0; i < 3; i += 1) {
			await shouldChallengeWithTurnstile(kv, requestFrom());
		}

		expect(await shouldChallengeWithTurnstile(kv, requestFrom())).toBe(false);
	});

	test("answers true once an address has spent exactly half its shared budget", async () => {
		let kv = memoryKv();

		for (let i = 0; i < 4; i += 1) {
			await shouldChallengeWithTurnstile(kv, requestFrom());
		}

		expect(await shouldChallengeWithTurnstile(kv, requestFrom())).toBe(true);
	});

	test("stays true well past the halfway mark", async () => {
		let kv = memoryKv();

		for (let i = 0; i < 7; i += 1) {
			await shouldChallengeWithTurnstile(kv, requestFrom());
		}

		expect(await shouldChallengeWithTurnstile(kv, requestFrom())).toBe(true);
	});

	test("tracks each address's own budget separately", async () => {
		let kv = memoryKv();

		for (let i = 0; i < 5; i += 1) {
			await shouldChallengeWithTurnstile(kv, requestFrom("203.0.113.7"));
		}

		expect(await shouldChallengeWithTurnstile(kv, requestFrom("203.0.113.7"))).toBe(true);
		expect(await shouldChallengeWithTurnstile(kv, requestFrom("198.51.100.9"))).toBe(false);
	});

	test("answers false rather than throwing when the KV namespace cannot be read", async () => {
		let kv = brokenKv();

		expect(await shouldChallengeWithTurnstile(kv, requestFrom())).toBe(false);
	});
});

describe("turnstileChallenge middleware", () => {
	function buildRouter(kv: RateLimitKVNamespace) {
		let middleware: Middleware[] = [turnstileChallenge(kv)];
		let router = createRouter({ middleware });
		router.get("/u/sign-in", {
			handler: (context) => new Response(String(context.turnstileChallenge)),
		});
		return router;
	}

	test("exposes false on the context before the halfway mark", async () => {
		let router = buildRouter(memoryKv());

		let response = await router.fetch(requestFrom());

		expect(await response.text()).toBe("false");
	});

	test("exposes true on the context once the halfway mark is crossed", async () => {
		let kv = memoryKv();
		let router = buildRouter(kv);

		for (let i = 0; i < 4; i += 1) await router.fetch(requestFrom());
		let response = await router.fetch(requestFrom());

		expect(await response.text()).toBe("true");
	});
});
