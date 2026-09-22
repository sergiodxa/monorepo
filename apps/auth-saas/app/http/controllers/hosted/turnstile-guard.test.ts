/**
 * Unit tests for the two Turnstile submission policies: sign-up's
 * unconditional, closed policy refuses on a missing token, a refused one, or
 * an unreachable verification call alike; sign-in and reset's conditional,
 * open policy refuses on a missing or refused token but lets an unreachable
 * verification call through. The `siteverify` call is stubbed with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	passesConditionalTurnstileChallenge,
	passesUnconditionalTurnstileChallenge,
} from "./turnstile-guard";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function form(fields: Record<string, string> = {}): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

describe("passesUnconditionalTurnstileChallenge", () => {
	test("refuses a submission with no token", async () => {
		let passed = await passesUnconditionalTurnstileChallenge("secret", form());
		expect(passed).toBe(false);
	});

	test("passes a submission whose token Turnstile confirms", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));

		let passed = await passesUnconditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-valid-token" }),
		);

		expect(passed).toBe(true);
	});

	test("refuses a submission whose token Turnstile rejects", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: false })));

		let passed = await passesUnconditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-bad-token" }),
		);

		expect(passed).toBe(false);
	});

	test("refuses a submission when the verification call cannot complete", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		let passed = await passesUnconditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-token" }),
		);

		expect(passed).toBe(false);
	});
});

describe("passesConditionalTurnstileChallenge", () => {
	test("refuses a submission with no token", async () => {
		let passed = await passesConditionalTurnstileChallenge("secret", form());
		expect(passed).toBe(false);
	});

	test("passes a submission whose token Turnstile confirms", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));

		let passed = await passesConditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-valid-token" }),
		);

		expect(passed).toBe(true);
	});

	test("refuses a submission whose token Turnstile rejects", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: false })));

		let passed = await passesConditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-bad-token" }),
		);

		expect(passed).toBe(false);
	});

	test("passes a submission when the verification call cannot complete", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		let passed = await passesConditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-token" }),
		);

		expect(passed).toBe(true);
	});
});
