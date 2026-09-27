/**
 * Tests for the router middleware: its contract driven through the in-memory provider,
 * end to end with Turnstile over a stubbed `siteverify`, and with a test-only ALTCHA-shaped
 * provider that verifies a proof of work locally, a provider unlike every hosted one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as s from "remix/data-schema";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { MemoryCaptcha } from "./memory.js";
import { captcha } from "./middleware.js";
import { Turnstile } from "./turnstile.js";

import type { Captcha } from "./index.js";

import { CaptchaError } from "./index.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const HMAC_KEY = "altcha-test-key";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The payload ALTCHA's widget base64-encodes into its `altcha` field. */
const ALTCHA_PAYLOAD = s.object({
	algorithm: s.literal("SHA-256"),
	challenge: s.string(),
	number: s.number(),
	salt: s.string(),
	signature: s.string(),
});

/** Lowercase hex of a digest, the encoding ALTCHA compares challenges and signatures in. */
function hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** `SHA-256(salt + number)`, the challenge a solved payload must reproduce. */
async function challengeOf(salt: string, number: number): Promise<string> {
	let data = new TextEncoder().encode(`${salt}${number}`);
	return hex(await crypto.subtle.digest("SHA-256", data));
}

/** `HMAC-SHA-256(key, challenge)`, the server's signature over a challenge it issued. */
async function sign(key: string, challenge: string): Promise<string> {
	let cryptoKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return hex(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(challenge)));
}

/**
 * A minimal ALTCHA-shaped provider: self-hosted proof of work, verified with no network
 * call. It confirms neither hostname, action, score nor solve time, so every one of those
 * stays `undefined`, and it ignores `remoteIp`.
 */
class Altcha implements Captcha {
	readonly field = "altcha";

	#hmacKey: string;

	constructor(hmacKey: string) {
		this.#hmacKey = hmacKey;
	}

	async verify(token: string): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));

		let decoded: unknown;
		try {
			decoded = JSON.parse(atob(token));
		} catch {
			return failure(new CaptchaError("rejected", ["malformed-payload"]));
		}

		let parsed = s.parseSafe(ALTCHA_PAYLOAD, decoded);
		if (!parsed.success) return failure(new CaptchaError("rejected", ["malformed-payload"]));
		let payload = parsed.value;

		let expires = Number(new URLSearchParams(payload.salt.split("?")[1] ?? "").get("expires"));
		if (Number.isFinite(expires) && expires > 0 && expires * 1000 < Date.now()) {
			return failure(new CaptchaError("expired"));
		}

		if ((await challengeOf(payload.salt, payload.number)) !== payload.challenge) {
			return failure(new CaptchaError("rejected", ["wrong-solution"]));
		}
		if ((await sign(this.#hmacKey, payload.challenge)) !== payload.signature) {
			return failure(new CaptchaError("rejected", ["bad-signature"]));
		}

		return success({});
	}
}

/** A solved ALTCHA payload, as the widget would submit it, expiring at `expires` (seconds). */
async function solvedAltcha(
	options: { key?: string; expires?: number; number?: number } = {},
): Promise<string> {
	let expires = options.expires ?? Math.floor(Date.now() / 1000) + 60;
	let salt = `0123abcd?expires=${expires}`;
	let challenge = await challengeOf(salt, 42);
	let signature = await sign(options.key ?? HMAC_KEY, challenge);
	return btoa(
		JSON.stringify({
			algorithm: "SHA-256",
			challenge,
			number: options.number ?? 42,
			salt,
			signature,
		}),
	);
}

/**
 * A form POST carrying `fields`, from `ip` when given. The body is a string with an
 * explicit content type, since MSW's header recording breaks a body-derived one.
 */
function post(fields: Record<string, string>, ip?: string, path = "/sign-up"): Request {
	let headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
	if (ip !== undefined) headers["CF-Connecting-IP"] = ip;
	return new Request(`https://example.com${path}`, {
		method: "POST",
		body: new URLSearchParams(fields).toString(),
		headers,
	});
}

/** Stubs `siteverify` with `body`, recording each form it received. */
function answerSiteverify(body: Record<string, unknown>): URLSearchParams[] {
	let received: URLSearchParams[] = [];
	server.use(
		http.post(SITEVERIFY_URL, async ({ request }) => {
			received.push(new URLSearchParams(await request.text()));
			return HttpResponse.json(body);
		}),
	);
	return received;
}

/** Serializes the outcome a handler saw, so a test asserts on what reached the handler. */
function describeOutcome(outcome: Result<Captcha.Verification, CaptchaError>): Response {
	if (isSuccess(outcome)) return Response.json({ ok: true, verification: outcome.data });
	return Response.json({ ok: false, code: outcome.error.code });
}

describe("captcha middleware", () => {
	/** A router guarding `POST /sign-up` with `provider`, answering with the outcome it saw. */
	function guarded(provider: Captcha, options: Parameters<typeof captcha>[1] = {}) {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(provider, options)],
			handler: (ctx) => describeOutcome(ctx.captcha),
		});
		return router;
	}

	test("publishes the verification and passes the visitor's address on", async () => {
		let provider = new MemoryCaptcha({ verification: { hostname: "example.com" } });

		let response = await guarded(provider).fetch(
			post({ "captcha-response": "token" }, "203.0.113.7"),
		);

		expect(await response.json()).toEqual({
			ok: true,
			verification: { hostname: "example.com" },
		});
		expect(provider.calls).toEqual([{ token: "token", remoteIp: "203.0.113.7" }]);
	});

	test("reads the address through a custom resolver", async () => {
		let provider = new MemoryCaptcha();
		let router = guarded(provider, { remoteIp: (request) => request.headers.get("X-Real-IP") });

		let request = post({ "captcha-response": "token" });
		request.headers.set("X-Real-IP", "198.51.100.1");
		await router.fetch(request);

		expect(provider.last).toEqual({ token: "token", remoteIp: "198.51.100.1" });
	});

	test("refuses with 403 by default, before the handler runs", async () => {
		let provider = new MemoryCaptcha().failNext("rejected");
		let reached = false;
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(provider)],
			handler: () => {
				reached = true;
				return new Response("ok");
			},
		});

		let response = await router.fetch(post({ "captcha-response": "token" }));

		expect(response.status).toBe(403);
		expect(reached).toBe(false);
	});

	test("refuses a submission without the field, without calling the provider", async () => {
		let provider = new MemoryCaptcha();

		let response = await guarded(provider, { onFailure: () => null }).fetch(
			post({ email: "ada@example.com" }),
		);

		expect(await response.json()).toEqual({ ok: false, code: "missing-token" });
		expect(provider.calls).toHaveLength(0);
	});

	test("lets the app answer a failure, or continue past it", async () => {
		let provider = new MemoryCaptcha().failNext("unavailable").failNext("rejected");
		let router = guarded(provider, {
			onFailure: (error) =>
				error.code === "unavailable" ? null : new Response("try again", { status: 400 }),
		});

		let outage = await router.fetch(post({ "captcha-response": "token" }));
		let bot = await router.fetch(post({ "captcha-response": "token" }));

		expect(await outage.json()).toEqual({ ok: false, code: "unavailable" });
		expect(bot.status).toBe(400);
	});

	test("refuses a token minted for another action or site", async () => {
		let provider = new MemoryCaptcha({
			verification: { hostname: "evil.example", action: "comment" },
		});

		let action = await guarded(provider, { action: "sign-up", onFailure: () => null }).fetch(
			post({ "captcha-response": "token" }),
		);
		let hostname = await guarded(provider, {
			hostname: "example.com",
			onFailure: () => null,
		}).fetch(post({ "captcha-response": "token" }));

		expect(await action.json()).toEqual({ ok: false, code: "action-mismatch" });
		expect(await hostname.json()).toEqual({ ok: false, code: "hostname-mismatch" });
	});

	test("accepts a token whose action and hostname match", async () => {
		let provider = new MemoryCaptcha({
			verification: { hostname: "example.com", action: "sign-up" },
		});

		let response = await guarded(provider, { action: "sign-up", hostname: "example.com" }).fetch(
			post({ "captcha-response": "token" }),
		);

		expect(await response.json()).toMatchObject({ ok: true });
	});

	test("leaves the body readable for the handler", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new MemoryCaptcha())],
			handler: async (ctx) => {
				let email = (await ctx.request.formData()).get("email");
				return new Response(typeof email === "string" ? email : "");
			},
		});

		let response = await router.fetch(
			post({ "captcha-response": "token", email: "ada@example.com" }),
		);

		expect(await response.text()).toBe("ada@example.com");
	});

	test("reads the token from formData() when the router parsed the body already", async () => {
		let provider = new MemoryCaptcha();
		let router = createRouter({ middleware: [formData()] });
		router.post("/sign-up", {
			middleware: [captcha(provider)],
			handler: (ctx) => describeOutcome(ctx.captcha),
		});

		let response = await router.fetch(post({ "captcha-response": "token" }));

		expect(await response.json()).toEqual({ ok: true, verification: {} });
		expect(provider.last?.token).toBe("token");
	});

	test("verifies every request it is installed on, so ctx.captcha is always published", async () => {
		let router = createRouter();
		router.get("/sign-up", {
			middleware: [captcha(new MemoryCaptcha(), { onFailure: () => null })],
			handler: (ctx) => describeOutcome(ctx.captcha),
		});

		let response = await router.fetch("https://example.com/sign-up");

		expect(await response.json()).toEqual({ ok: false, code: "missing-token" });
	});

	test("reports a JSON body as a missing token", async () => {
		let response = await guarded(new MemoryCaptcha(), { onFailure: () => null }).fetch(
			new Request("https://example.com/sign-up", {
				method: "POST",
				body: JSON.stringify({ "captcha-response": "token" }),
				headers: { "Content-Type": "application/json" },
			}),
		);

		expect(await response.json()).toEqual({ ok: false, code: "missing-token" });
	});
});

describe("captcha middleware with Turnstile", () => {
	test("verifies the widget's token with Cloudflare, passing the visitor's address", async () => {
		let received = answerSiteverify({ success: true, hostname: "example.com", action: "sign-up" });
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new Turnstile({ secretKey: "secret" }), { action: "sign-up" })],
			handler: (ctx) => describeOutcome(ctx.captcha),
		});

		let response = await router.fetch(post({ "cf-turnstile-response": "token" }, "203.0.113.7"));

		expect(await response.json()).toEqual({
			ok: true,
			verification: { hostname: "example.com", action: "sign-up" },
		});
		expect(received[0]?.get("response")).toBe("token");
		expect(received[0]?.get("remoteip")).toBe("203.0.113.7");
	});

	test("refuses the submission Cloudflare rejected", async () => {
		answerSiteverify({ success: false, "error-codes": ["invalid-input-response"] });
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new Turnstile({ secretKey: "secret" }))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(post({ "cf-turnstile-response": "token" }));

		expect(response.status).toBe(403);
	});
});

describe("captcha middleware with a second provider", () => {
	/** A router guarding `/sign-up` with the ALTCHA-shaped provider, continuing past failures. */
	function altchaRouter(options: Parameters<typeof captcha>[1] = {}) {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new Altcha(HMAC_KEY), { onFailure: () => null, ...options })],
			handler: (ctx) => describeOutcome(ctx.captcha),
		});
		return router;
	}

	test("verifies a solved proof of work from the provider's own field", async () => {
		let response = await altchaRouter().fetch(
			post({ altcha: await solvedAltcha(), "cf-turnstile-response": "ignored" }, "203.0.113.7"),
		);

		expect(await response.json()).toEqual({ ok: true, verification: {} });
	});

	test("ignores a token in another provider's field", async () => {
		let response = await altchaRouter().fetch(post({ "cf-turnstile-response": "token" }));

		expect(await response.json()).toEqual({ ok: false, code: "missing-token" });
	});

	test("rejects a payload signed with another key", async () => {
		let response = await altchaRouter().fetch(post({ altcha: await solvedAltcha({ key: "x" }) }));

		expect(await response.json()).toEqual({ ok: false, code: "rejected" });
	});

	test("rejects a wrong solution", async () => {
		let response = await altchaRouter().fetch(post({ altcha: await solvedAltcha({ number: 7 }) }));

		expect(await response.json()).toEqual({ ok: false, code: "rejected" });
	});

	test("reports an expired challenge", async () => {
		let expired = await solvedAltcha({ expires: Math.floor(Date.now() / 1000) - 1 });

		let response = await altchaRouter().fetch(post({ altcha: expired }));

		expect(await response.json()).toEqual({ ok: false, code: "expired" });
	});

	test("refuses an expected action the provider cannot vouch for", async () => {
		let response = await altchaRouter({ action: "sign-up" }).fetch(
			post({ altcha: await solvedAltcha() }),
		);

		expect(await response.json()).toEqual({ ok: false, code: "action-mismatch" });
	});

	test("refuses with 403 by default", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new Altcha(HMAC_KEY))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(post({ altcha: "garbage" }));

		expect(response.status).toBe(403);
	});

	test("publishes failures as a Result a handler can narrow", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(new Altcha(HMAC_KEY), { onFailure: () => null })],
			handler: (ctx) =>
				new Response(isFailure(ctx.captcha) ? ctx.captcha.error.providerCodes.join() : "ok"),
		});

		let response = await router.fetch(post({ altcha: await solvedAltcha({ key: "x" }) }));

		expect(await response.text()).toBe("bad-signature");
	});
});
