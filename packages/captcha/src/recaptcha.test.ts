/**
 * Tests for reCAPTCHA's server side against a stubbed `siteverify`: v2 answers with no
 * score, v3 answers held to the score threshold and reporting their action, and every
 * documented error code's neutral mapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ReCaptcha } from "./recaptcha.js";

import type { CaptchaError } from "./index.js";

const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every `siteverify` call with `body`, recording each form it received. */
function answer(body: Record<string, unknown>, init?: ResponseInit): URLSearchParams[] {
	let received: URLSearchParams[] = [];
	server.use(
		http.post(SITEVERIFY_URL, async ({ request }) => {
			received.push(new URLSearchParams(await request.text()));
			return HttpResponse.json(body, init);
		}),
	);
	return received;
}

/** The error a failed verification carries. */
async function refusal(recaptcha: ReCaptcha, token = "token"): Promise<CaptchaError> {
	let result = await recaptcha.verify(token);
	if (!isFailure(result)) return expect.unreachable("expected the verification to fail");
	return result.error;
}

describe("ReCaptcha", () => {
	test("submits the widget's field name", () => {
		expect(new ReCaptcha({ secretKey: "secret" }).field).toBe("g-recaptcha-response");
	});

	test("sends the secret, the token and the visitor's address", async () => {
		let received = answer({ success: true });

		await new ReCaptcha({ secretKey: "secret" }).verify("token", { remoteIp: "203.0.113.7" });

		expect(Object.fromEntries(received[0] ?? [])).toEqual({
			secret: "secret",
			response: "token",
			remoteip: "203.0.113.7",
		});
	});

	test("reads a v2 answer's hostname and solve time, with no score", async () => {
		answer({ success: true, hostname: "example.com", challenge_ts: "2026-09-27T10:00:00Z" });

		let result = await new ReCaptcha({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data).toEqual({
			hostname: "example.com",
			challengedAt: new Date("2026-09-27T10:00:00Z"),
		});
	});

	test("reads a v3 answer's score and action", async () => {
		answer({ success: true, hostname: "example.com", score: 0.9, action: "sign_up" });

		let result = await new ReCaptcha({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data).toEqual({
			hostname: "example.com",
			score: 0.9,
			action: "sign_up",
		});
	});

	test("refuses a v3 score under the default 0.5 threshold as low-score", async () => {
		answer({ success: true, score: 0.3, action: "sign_up" });

		let error = await refusal(new ReCaptcha({ secretKey: "secret" }));

		expect(error.code).toBe("low-score");
	});

	test("holds a v3 score to the configured threshold", async () => {
		answer({ success: true, score: 0.6 });

		let strict = await refusal(new ReCaptcha({ secretKey: "secret", minScore: 0.7 }));
		let lenient = await new ReCaptcha({ secretKey: "secret", minScore: 0.6 }).verify("token");

		expect(strict.code).toBe("low-score");
		expect(isSuccess(lenient)).toBe(true);
	});

	test("refuses an empty token without calling Google", async () => {
		let received = answer({ success: true });

		expect((await refusal(new ReCaptcha({ secretKey: "secret" }), "")).code).toBe("missing-token");
		expect(received).toHaveLength(0);
	});

	test.each([
		["invalid-input-response", "rejected"],
		["missing-input-response", "rejected"],
		["timeout-or-duplicate", "expired"],
		["missing-input-secret", "unavailable"],
		["invalid-input-secret", "unavailable"],
		["bad-request", "unavailable"],
	])("maps %s to %s", async (code, expected) => {
		answer({ success: false, "error-codes": [code] });

		let error = await refusal(new ReCaptcha({ secretKey: "secret" }));

		expect(error.code).toBe(expected);
		expect(error.providerCodes).toEqual([code]);
	});

	test("reports an unreachable endpoint as unavailable", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		expect((await refusal(new ReCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a non-OK status as unavailable", async () => {
		answer({ success: true }, { status: 502 });

		expect((await refusal(new ReCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a malformed body as unavailable", async () => {
		answer({ success: true, score: "high" });

		expect((await refusal(new ReCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});
});
