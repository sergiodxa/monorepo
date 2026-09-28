/**
 * The Turnstile challenge trigger against the app's real `TURNSTILE_CHALLENGE_KV` binding: an
 * address under half its shared budget sees no challenge, one that has spent half does, each
 * address counts apart, sign-in and reset spend one shared counter, and a namespace that
 * cannot answer means no challenge. Real KV also enforces its 60-second TTL floor on each write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { env } from "cloudflare:test";
import { createRouter } from "remix/router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { shouldChallengeWithTurnstile, turnstileChallenge } from "./turnstile-challenge";

afterEach(() => {
	vi.restoreAllMocks();
});

/**
 * A sign-in request from one connecting address. Every test uses its own address, so no test
 * reads a counter another one spent, whatever storage isolation the pool applies.
 */
function requestFrom(ip: string, path = "/u/sign-in"): Request {
	return new Request(`https://example.com${path}`, { headers: { "CF-Connecting-IP": ip } });
}

describe("shouldChallengeWithTurnstile", () => {
	test("answers false while an address stays under half its shared budget", async () => {
		for (let i = 0; i < 3; i += 1) {
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.1"));
		}

		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.1")),
		).toBe(false);
	});

	test("answers true once an address has spent exactly half its shared budget", async () => {
		for (let i = 0; i < 4; i += 1) {
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.2"));
		}

		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.2")),
		).toBe(true);
	});

	test("stays true well past the halfway mark", async () => {
		for (let i = 0; i < 7; i += 1) {
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.3"));
		}

		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.3")),
		).toBe(true);
	});

	test("tracks each address's own budget separately", async () => {
		for (let i = 0; i < 5; i += 1) {
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.4"));
		}

		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.4")),
		).toBe(true);
		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("198.51.100.4")),
		).toBe(false);
	});

	test("answers false rather than throwing when the KV namespace cannot be read", async () => {
		vi.spyOn(env.TURNSTILE_CHALLENGE_KV, "get").mockRejectedValue(new Error("kv unavailable"));

		expect(
			await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, requestFrom("203.0.113.5")),
		).toBe(false);
	});
});

describe("turnstileChallenge middleware", () => {
	/** One middleware instance mounted on sign-in and reset, the way `tenant-app.ts` shares it. */
	function buildRouter() {
		let challenge = turnstileChallenge(env.TURNSTILE_CHALLENGE_KV);
		let middleware: Middleware[] = [challenge];
		let router = createRouter({ middleware });
		let answer = (context: { turnstileChallenge: boolean }) =>
			new Response(String(context.turnstileChallenge));
		router.get("/u/sign-in", { handler: answer });
		router.get("/u/reset", { handler: answer });
		return router;
	}

	test("exposes false on the context before the halfway mark", async () => {
		let router = buildRouter();

		let response = await router.fetch(requestFrom("203.0.113.6"));

		expect(await response.text()).toBe("false");
	});

	test("exposes true on the context once the halfway mark is crossed", async () => {
		let router = buildRouter();

		for (let i = 0; i < 4; i += 1) await router.fetch(requestFrom("203.0.113.7"));
		let response = await router.fetch(requestFrom("203.0.113.7"));

		expect(await response.text()).toBe("true");
	});

	test("spends one counter across sign-in and reset, so page loads on either cross the mark", async () => {
		let router = buildRouter();

		for (let i = 0; i < 2; i += 1) await router.fetch(requestFrom("203.0.113.8", "/u/sign-in"));
		for (let i = 0; i < 3; i += 1) await router.fetch(requestFrom("203.0.113.8", "/u/reset"));
		let response = await router.fetch(requestFrom("203.0.113.8", "/u/reset"));

		expect(await response.text()).toBe("true");
	});
});
