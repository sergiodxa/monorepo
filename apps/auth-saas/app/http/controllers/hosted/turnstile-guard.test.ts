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
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
	passesConditionalTurnstileChallenge,
	passesUnconditionalTurnstileChallenge,
} from "./turnstile-guard";

/** A `TurnstileAttackSignal` whose `writeDataPoint` is a spy. */
function attackSignal() {
	let writeDataPoint = vi.fn();
	return {
		attackSignal: { env: { ANALYTICS: { writeDataPoint } }, tenantId: "ten_1" },
		writeDataPoint,
	};
}

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

	test("records a refused-turnstile attack signal for a refused token", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: false })));
		let { attackSignal: signal, writeDataPoint } = attackSignal();

		await passesUnconditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-bad-token" }),
			undefined,
			signal,
		);

		expect(writeDataPoint).toHaveBeenCalledWith({
			indexes: ["ten_1"],
			blobs: ["attack_signal", "ten_1", "credential", "refused-turnstile", "invalid-token", ""],
			doubles: [1],
		});
	});

	test("records no attack signal for a submission Turnstile confirms", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));
		let { attackSignal: signal, writeDataPoint } = attackSignal();

		await passesUnconditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-valid-token" }),
			undefined,
			signal,
		);

		expect(writeDataPoint).not.toHaveBeenCalled();
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

	test("records a refused-turnstile attack signal for a missing token", async () => {
		let { attackSignal: signal, writeDataPoint } = attackSignal();

		await passesConditionalTurnstileChallenge("secret", form(), undefined, signal);

		expect(writeDataPoint).toHaveBeenCalledWith({
			indexes: ["ten_1"],
			blobs: ["attack_signal", "ten_1", "credential", "refused-turnstile", "no-token", ""],
			doubles: [1],
		});
	});

	test("records no attack signal when the verification call cannot complete", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));
		let { attackSignal: signal, writeDataPoint } = attackSignal();

		await passesConditionalTurnstileChallenge(
			"secret",
			form({ "cf-turnstile-response": "a-token" }),
			undefined,
			signal,
		);

		expect(writeDataPoint).not.toHaveBeenCalled();
	});
});
