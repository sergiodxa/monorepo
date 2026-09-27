/**
 * Tests for hCaptcha's server side against a stubbed `siteverify`: what it sends, the
 * facts it reads back with the risk score turned into the shared human-likelihood score,
 * the risk threshold, and every documented error code's neutral mapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { HCaptcha } from "./hcaptcha.js";

import type { CaptchaError } from "./index.js";

const SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify";

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
async function refusal(hcaptcha: HCaptcha, token = "token"): Promise<CaptchaError> {
	let result = await hcaptcha.verify(token);
	if (!isFailure(result)) return expect.unreachable("expected the verification to fail");
	return result.error;
}

describe("HCaptcha", () => {
	test("submits the widget's field name", () => {
		expect(new HCaptcha({ secretKey: "secret" }).field).toBe("h-captcha-response");
	});

	test("sends the secret, the token, the address and the expected site key", async () => {
		let received = answer({ success: true });

		await new HCaptcha({ secretKey: "secret", siteKey: "site" }).verify("token", {
			remoteIp: "203.0.113.7",
		});

		expect(Object.fromEntries(received[0] ?? [])).toEqual({
			secret: "secret",
			response: "token",
			remoteip: "203.0.113.7",
			sitekey: "site",
		});
	});

	test("reads back the hostname and solve time", async () => {
		answer({ success: true, hostname: "example.com", challenge_ts: "2026-09-27T10:00:00Z" });

		let result = await new HCaptcha({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data).toEqual({
			hostname: "example.com",
			challengedAt: new Date("2026-09-27T10:00:00Z"),
		});
	});

	test("reports an Enterprise risk score as the likelihood the visitor is human", async () => {
		answer({ success: true, score: 0.25 });

		let result = await new HCaptcha({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data.score).toBe(0.75);
	});

	test("reports no score on a plan that does not score", async () => {
		answer({ success: true, score: null });

		let result = await new HCaptcha({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data.score).toBeUndefined();
	});

	test("refuses a risk score above the threshold as low-score", async () => {
		answer({ success: true, score: 0.9 });

		let error = await refusal(new HCaptcha({ secretKey: "secret", maxRiskScore: 0.5 }));

		expect(error.code).toBe("low-score");
	});

	test("accepts a risk score at the threshold", async () => {
		answer({ success: true, score: 0.5 });

		let result = await new HCaptcha({ secretKey: "secret", maxRiskScore: 0.5 }).verify("token");

		expect(isSuccess(result)).toBe(true);
	});

	test("refuses an empty token without calling hCaptcha", async () => {
		let received = answer({ success: true });

		expect((await refusal(new HCaptcha({ secretKey: "secret" }), "")).code).toBe("missing-token");
		expect(received).toHaveLength(0);
	});

	test.each([
		["invalid-input-response", "rejected"],
		["missing-input-response", "rejected"],
		["expired-input-response", "expired"],
		["already-seen-response", "expired"],
		["missing-input-secret", "unavailable"],
		["invalid-input-secret", "unavailable"],
		["bad-request", "unavailable"],
		["missing-remoteip", "unavailable"],
		["invalid-remoteip", "unavailable"],
		["not-using-dummy-passcode", "unavailable"],
		["sitekey-secret-mismatch", "unavailable"],
	])("maps %s to %s", async (code, expected) => {
		answer({ success: false, "error-codes": [code] });

		let error = await refusal(new HCaptcha({ secretKey: "secret" }));

		expect(error.code).toBe(expected);
		expect(error.providerCodes).toEqual([code]);
	});

	test("reports an unreachable endpoint as unavailable", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		expect((await refusal(new HCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a non-OK status as unavailable", async () => {
		answer({ success: true }, { status: 500 });

		expect((await refusal(new HCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a malformed body as unavailable", async () => {
		answer({ success: "true" });

		expect((await refusal(new HCaptcha({ secretKey: "secret" }))).code).toBe("unavailable");
	});
});
