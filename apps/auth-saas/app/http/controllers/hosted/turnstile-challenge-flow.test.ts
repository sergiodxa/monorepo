/**
 * Drives `/u/sign-in` and `/u/reset` through a real router mounted the way `tenant-app.ts`
 * wires them: the widget stays off an unchallenged page and appears on a challenged one, and a
 * submission made while challenged is refused without a token or with one Turnstile rejects, but
 * proceeds when the token checks out or the verification call cannot complete. The challenge
 * decision is fixed per test; the KV counter behind it has its own Workers-pool test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { MemoryCaptcha } from "@sdxc/captcha/memory";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import i18n from "~/app/http/middleware/i18n";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { TurnstileChallengeContext } from "~/app/http/middleware/turnstile-challenge";
import { turnstileVerification } from "~/app/http/middleware/turnstile-verification";
import { TENANT_SECURITY_POLICY } from "~/app/http/security-policy";
import routes from "~/routes/tenant";

import { resetShow, resetSubmit } from "./reset";
import { signInShow, signInSubmit } from "./sign-in";
import { buildHarness, createTestSubjectWithPassword } from "./test-harness";

let turnstile = new MemoryCaptcha({ field: "cf-turnstile-response" });
beforeEach(() => turnstile.reset());

/**
 * Publishes a fixed challenge decision the way `turnstileChallenge` publishes the one its counter
 * reaches, so a test chooses whether the address it drives is challenged.
 *
 * @param challenged - Whether the connecting address has crossed half its shared budget.
 * @returns The middleware setting `turnstileChallenge` on the context.
 */
function fixedChallenge(challenged: boolean): Middleware {
	return (context, next) => {
		context.set(TurnstileChallengeContext, challenged, { property: "turnstileChallenge" });
		return next();
	};
}

/** Builds a router mounting the challenge decision on sign-in and reset, the way `tenant-app.ts` shares one across both. */
async function buildChallengeRouter(challenged: boolean) {
	let harness = await buildHarness();
	let challenge = fixedChallenge(challenged);
	let verification = turnstileVerification(turnstile);

	let middleware: Middleware[] = [
		securityHeaders(TENANT_SECURITY_POLICY) as Middleware,
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
		middleware: [challenge, verification],
		handler: signInSubmit as RequestHandler,
	});
	router.map(routes.hostedResetShow, {
		middleware: [challenge],
		handler: resetShow as RequestHandler,
	});
	router.map(routes.hostedResetSubmit, {
		middleware: [challenge, verification],
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

describe("sign-in", () => {
	test("shows no Turnstile widget while the address is not challenged", async () => {
		let { harness, router } = await buildChallengeRouter(false);

		let response = await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));

		let body = await response.text();
		expect(body).not.toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("shows the Turnstile widget once the address is challenged", async () => {
		let { harness, router } = await buildChallengeRouter(true);

		let response = await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));

		let body = await response.text();
		expect(body).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("loads the widget's script under the nonce the response's CSP allows", async () => {
		let { harness, router } = await buildChallengeRouter(true);

		let response = await router.fetch(requestTo(harness, "/u/sign-in?interaction=int_1"));

		let policy = response.headers.get("Content-Security-Policy-Report-Only") ?? "";
		let nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
		expect(nonce).toBeDefined();
		expect(await response.text()).toContain(`nonce="${nonce}"`);
	});

	test("proceeds without a token while the address is not challenged", async () => {
		let { harness, router } = await buildChallengeRouter(false);

		let response = await router.fetch(
			requestTo(harness, "/u/sign-in?interaction=int_1", {
				method: "POST",
				body: new URLSearchParams({ identifier: "jane@example.com", password: "wrong-password" }),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		let body = await response.text();
		expect(body).not.toContain("verify you're not a robot");
		expect(body).toContain("incorrect");
		expect(turnstile.calls).toHaveLength(0);
	});

	test("refuses a challenged submission with no Turnstile token", async () => {
		let { harness, router } = await buildChallengeRouter(true);

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
		turnstile.failNext("rejected");
		let { harness, router } = await buildChallengeRouter(true);

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
		let { harness, router } = await buildChallengeRouter(true);

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
		turnstile.failNext("unavailable");
		let { harness, router } = await buildChallengeRouter(true);

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
		let { harness, router } = await buildChallengeRouter(true);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

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

		expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});
});

describe("reset", () => {
	test("shows the Turnstile widget on the request leg once the address is challenged", async () => {
		let { harness, router } = await buildChallengeRouter(true);

		let requestLeg = await router.fetch(requestTo(harness, "/u/reset"));
		expect(await requestLeg.text()).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("refuses a challenged request submission with no Turnstile token", async () => {
		let { harness, router } = await buildChallengeRouter(true);

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
		turnstile.failNext("unavailable");
		let { harness, router } = await buildChallengeRouter(true);

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
