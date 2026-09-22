/**
 * Unit tests for the Turnstile verification module: a token Cloudflare
 * confirms verifies, a token it refuses reports `invalid-token`, and a call
 * that cannot complete — a network failure, a non-2xx answer, or an answer
 * this module cannot parse — reports `verification-unavailable` instead of
 * throwing. The `siteverify` call is stubbed with MSW; nothing here ever
 * reaches the real network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { verifyTurnstileToken } from "./turnstile";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("verifyTurnstileToken", () => {
	test("confirms a token Turnstile reports success for", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));

		let result = await verifyTurnstileToken("secret", "a-valid-token");

		expect(result).toEqual({ ok: true });
	});

	test("reports invalid-token when Turnstile answers success: false", async () => {
		server.use(
			http.post(SITEVERIFY_URL, () =>
				HttpResponse.json({ success: false, "error-codes": ["invalid-input-response"] }),
			),
		);

		let result = await verifyTurnstileToken("secret", "a-bad-token");

		expect(result).toEqual({ ok: false, reason: "invalid-token" });
	});

	test("reports verification-unavailable when the call cannot reach Turnstile", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));

		let result = await verifyTurnstileToken("secret", "a-token");

		expect(result).toEqual({ ok: false, reason: "verification-unavailable" });
	});

	test("reports verification-unavailable on a non-2xx response", async () => {
		server.use(http.post(SITEVERIFY_URL, () => new HttpResponse(null, { status: 503 })));

		let result = await verifyTurnstileToken("secret", "a-token");

		expect(result).toEqual({ ok: false, reason: "verification-unavailable" });
	});

	test("reports verification-unavailable on an unparseable response body", async () => {
		server.use(http.post(SITEVERIFY_URL, () => new HttpResponse("not json", { status: 200 })));

		let result = await verifyTurnstileToken("secret", "a-token");

		expect(result).toEqual({ ok: false, reason: "verification-unavailable" });
	});

	test("posts the secret, the token and the remote address Cloudflare's own fields expect", async () => {
		let seen: URLSearchParams | undefined;
		server.use(
			http.post(SITEVERIFY_URL, async ({ request }) => {
				seen = new URLSearchParams(await request.text());
				return HttpResponse.json({ success: true });
			}),
		);

		await verifyTurnstileToken("the-secret", "the-token", "203.0.113.7");

		expect(seen?.get("secret")).toBe("the-secret");
		expect(seen?.get("response")).toBe("the-token");
		expect(seen?.get("remoteip")).toBe("203.0.113.7");
	});

	test("omits remoteip when no address is known", async () => {
		let seen: URLSearchParams | undefined;
		server.use(
			http.post(SITEVERIFY_URL, async ({ request }) => {
				seen = new URLSearchParams(await request.text());
				return HttpResponse.json({ success: true });
			}),
		);

		await verifyTurnstileToken("the-secret", "the-token");

		expect(seen?.has("remoteip")).toBe(false);
	});
});
