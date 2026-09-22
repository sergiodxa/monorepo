/**
 * Drives `/u/sign-in` and `/u/reset` through a real router mounting the
 * Turnstile challenge trigger the way `tenant-app.ts` wires it: the widget
 * stays off an ordinary page load, appears once the connecting address has
 * crossed half its shared budget, and a submission made while challenged is
 * refused without a token or a token Turnstile rejects, but proceeds when the
 * token checks out or when the verification call itself cannot complete — the
 * open policy sign-in and reset share. The `siteverify` call is stubbed with
 * MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware, RequestHandler } from "remix/router";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import i18n from "~/app/http/middleware/i18n";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { turnstileChallenge } from "~/app/http/middleware/turnstile-challenge";
import routes from "~/routes/tenant";

import { resetShow, resetSubmit } from "./reset";
import { signInShow, signInSubmit } from "./sign-in";
import { buildHarness, createTestSubjectWithPassword } from "./test-harness";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A KV namespace double backed by a Map, for a fresh challenge counter per test. */
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

/** Builds a router mounting `turnstileChallenge` on sign-in and reset, the way `tenant-app.ts` shares one instance across both. */
async function buildChallengeRouter(kv: RateLimitKVNamespace) {
	let harness = await buildHarness();
	let challenge = turnstileChallenge(kv);

	let middleware: Middleware[] = [
		tenant(() => harness.tenantDO as unknown as DurableObjectStub<Tenant>),
		render as Middleware,
		formData() as Middleware,
		i18n as Middleware,
	];
	let router = createRouter({ middleware });

	router.map(routes.hostedSignInShow, {
		middleware: [challenge],
		handler: signInShow as RequestHandler,
	});
	router.map(routes.hostedSignInSubmit, {
		middleware: [challenge],
		handler: signInSubmit as RequestHandler,
	});
	router.map(routes.hostedResetShow, {
		middleware: [challenge],
		handler: resetShow as RequestHandler,
	});
	router.map(routes.hostedResetSubmit, {
		middleware: [challenge],
		handler: resetSubmit as RequestHandler,
	});

	return { harness, router };
}

/** A request already resolved to the fixture tenant, sharing one connecting address across a test. */
function requestTo(
	harness: Awaited<ReturnType<typeof buildHarness>>,
	path: string,
	init: RequestInit = {},
) {
	let headers = new Headers(init.headers);
	headers.set("CF-Connecting-IP", "203.0.113.42");
	return harness.request(path, { ...init, headers });
}

/** Spends the shared challenge counter past its halfway mark with plain page loads. */
async function crossChallengeThreshold(
	router: Awaited<ReturnType<typeof buildChallengeRouter>>["router"],
	harness: Awaited<ReturnType<typeof buildHarness>>,
) {
	for (let i = 0; i < 5; i += 1) {
		await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));
	}
}

describe("sign-in", () => {
	test("shows no Turnstile widget before the address crosses the halfway mark", async () => {
		let { harness, router } = await buildChallengeRouter(memoryKv());

		let response = await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));

		let body = await response.text();
		expect(body).not.toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("shows the Turnstile widget once the address crosses the halfway mark", async () => {
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));

		let body = await response.text();
		expect(body).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("refuses a challenged submission with no Turnstile token", async () => {
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({ identifier: "jane@example.com", password: "whatever" }),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("verify you're not a robot");
	});

	test("refuses a challenged submission whose Turnstile token is rejected", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: false })));
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({
					identifier: "jane@example.com",
					password: "whatever",
					"cf-turnstile-response": "a-bad-token",
				}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("verify you're not a robot");
	});

	test("proceeds to the ordinary credential check once Turnstile confirms the token", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({
					identifier: "jane@example.com",
					password: "wrong-password",
					"cf-turnstile-response": "a-valid-token",
				}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).not.toContain("verify you're not a robot");
		expect(body).toContain("incorrect");
	});

	test("proceeds to the ordinary credential check when the Turnstile call cannot complete", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({
					identifier: "jane@example.com",
					password: "wrong-password",
					"cf-turnstile-response": "a-token",
				}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).not.toContain("verify you're not a robot");
		expect(body).toContain("incorrect");
	});

	test("a genuinely correct sign-in still succeeds once Turnstile confirms the token", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.json({ success: true })));
		let { harness, router } = await buildChallengeRouter(memoryKv());
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		await crossChallengeThreshold(router, harness);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({
					identifier: "jane@example.com",
					password: "correct horse battery staple",
					"cf-turnstile-response": "a-valid-token",
				}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		// The credential check itself proceeded and set a session cookie — the
		// interaction id names no real row, so `resumeAuthorization` is left to
		// answer whatever it answers past that point.
		expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});
});

describe("reset", () => {
	test("shows the Turnstile widget on both legs once the address crosses the halfway mark", async () => {
		let { harness, router } = await buildChallengeRouter(memoryKv());
		for (let i = 0; i < 5; i += 1) {
			await router.fetch(requestTo(harness, "/u/reset"));
		}

		let requestLeg = await router.fetch(requestTo(harness, "/u/reset"));
		expect(await requestLeg.text()).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("refuses a challenged request submission with no Turnstile token", async () => {
		let { harness, router } = await buildChallengeRouter(memoryKv());
		for (let i = 0; i < 5; i += 1) {
			await router.fetch(requestTo(harness, "/u/reset"));
		}

		let response = await router.fetch(
			requestTo(harness, "/u/reset", {
				method: "POST",
				body: new URLSearchParams({ identifier: "jane@example.com" }),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
	});

	test("proceeds when the Turnstile verification call cannot complete", async () => {
		server.use(http.post(SITEVERIFY_URL, () => HttpResponse.error()));
		let { harness, router } = await buildChallengeRouter(memoryKv());
		for (let i = 0; i < 5; i += 1) {
			await router.fetch(requestTo(harness, "/u/reset"));
		}

		let response = await router.fetch(
			requestTo(harness, "/u/reset", {
				method: "POST",
				body: new URLSearchParams({
					identifier: "jane@example.com",
					"cf-turnstile-response": "a-token",
				}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Check your email");
	});
});
