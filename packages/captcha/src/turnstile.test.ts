/**
 * Tests for Turnstile's server side against a stubbed `siteverify`: what it sends, the
 * facts it reads back, and every way the call fails — unreachable, a non-OK status, a
 * refused or reused token, a timeout, and a body in a shape Cloudflare never sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Turnstile } from "./turnstile.js";

import { CaptchaError } from "./index.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every `siteverify` call with `body`, recording each form it received. */
function answer(body: unknown, init?: ResponseInit): URLSearchParams[] {
	let received: URLSearchParams[] = [];
	server.use(
		http.post(SITEVERIFY_URL, async ({ request }) => {
			received.push(new URLSearchParams(await request.text()));
			return HttpResponse.json(body as Record<string, unknown>, init);
		}),
	);
	return received;
}

/** The error a failed verification carries, failing the test when it succeeded. */
async function refusal(turnstile: Turnstile, token = "token"): Promise<CaptchaError> {
	let result = await turnstile.verify(token);
	if (!isFailure(result)) return expect.unreachable("expected the verification to fail");
	return result.error;
}

describe("Turnstile", () => {
	test("submits the widget's field name", () => {
		expect(new Turnstile({ secretKey: "secret" }).field).toBe("cf-turnstile-response");
		expect(new Turnstile({ secretKey: "secret", field: "challenge" }).field).toBe("challenge");
	});

	test("sends the secret, the token and the visitor's address", async () => {
		let received = answer({ success: true });

		await new Turnstile({ secretKey: "secret" }).verify("token", { remoteIp: "203.0.113.7" });

		expect(received).toHaveLength(1);
		expect(Object.fromEntries(received[0] ?? [])).toEqual({
			secret: "secret",
			response: "token",
			remoteip: "203.0.113.7",
		});
	});

	test("leaves the address out when none is known", async () => {
		let received = answer({ success: true });

		await new Turnstile({ secretKey: "secret" }).verify("token");

		expect(received[0]?.has("remoteip")).toBe(false);
	});

	test("reads back the hostname, action and solve time", async () => {
		answer({
			success: true,
			hostname: "example.com",
			action: "sign-up",
			challenge_ts: "2026-09-27T10:00:00.000Z",
			"error-codes": [],
		});

		let result = await new Turnstile({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data).toEqual({
			hostname: "example.com",
			action: "sign-up",
			challengedAt: new Date("2026-09-27T10:00:00.000Z"),
		});
	});

	test("reports no action when the widget was rendered without one", async () => {
		answer({ success: true, hostname: "example.com", action: "" });

		let result = await new Turnstile({ secretKey: "secret" }).verify("token");

		expect(isSuccess(result) && result.data.action).toBeUndefined();
	});

	test("refuses without calling Cloudflare when the token is empty", async () => {
		let received = answer({ success: true });

		let error = await refusal(new Turnstile({ secretKey: "secret" }), "");

		expect(error.code).toBe("missing-token");
		expect(received).toHaveLength(0);
	});

	test("reports a refused token as rejected, keeping Cloudflare's codes", async () => {
		answer({ success: false, "error-codes": ["invalid-input-response"] });

		let error = await refusal(new Turnstile({ secretKey: "secret" }));

		expect(error).toBeInstanceOf(CaptchaError);
		expect(error.code).toBe("rejected");
		expect(error.providerCodes).toEqual(["invalid-input-response"]);
	});

	test("reports a reused or stale token as expired", async () => {
		answer({ success: false, "error-codes": ["timeout-or-duplicate"] });

		let error = await refusal(new Turnstile({ secretKey: "secret" }));

		expect(error.code).toBe("expired");
	});

	test.each(["invalid-input-secret", "missing-input-secret", "internal-error", "bad-request"])(
		"reports %s as unavailable, since the visitor cannot fix it",
		async (code) => {
			answer({ success: false, "error-codes": [code] });

			let error = await refusal(new Turnstile({ secretKey: "secret" }));

			expect(error.code).toBe("unavailable");
			expect(error.providerCodes).toEqual([code]);
		},
	);

	test("reports an unreachable endpoint as unavailable", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		expect((await refusal(new Turnstile({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a non-OK status as unavailable", async () => {
		answer({ success: true }, { status: 503 });

		expect((await refusal(new Turnstile({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test("reports a body that is not JSON as unavailable", async () => {
		server.use(http.post(SITEVERIFY_URL, () => new HttpResponse("<html>", { status: 200 })));

		expect((await refusal(new Turnstile({ secretKey: "secret" }))).code).toBe("unavailable");
	});

	test.each([{}, { success: "yes" }, { success: true, "error-codes": "none" }, []])(
		"reports a malformed body %j as unavailable",
		async (body) => {
			answer(body);

			expect((await refusal(new Turnstile({ secretKey: "secret" }))).code).toBe("unavailable");
		},
	);

	test("reports a call slower than the timeout as unavailable", async () => {
		server.use(
			http.post(SITEVERIFY_URL, async () => {
				await delay(200);
				return HttpResponse.json({ success: true });
			}),
		);

		let error = await refusal(new Turnstile({ secretKey: "secret", timeout: 20 }));

		expect(error.code).toBe("unavailable");
	});
});
