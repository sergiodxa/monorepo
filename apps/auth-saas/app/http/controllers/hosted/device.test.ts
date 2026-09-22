/**
 * Drives `/device` through a real tenant router the way `consent.test.ts`
 * drives `/u/consent`: no session round-trips through sign-in and back to the
 * exact request that sent it there; a valid code renders the consent screen;
 * approving or denying it is provable through a subsequent `redeemDeviceCode`
 * poll, the same RPC a device's own poll reaches; an unknown or mistyped code
 * renders an error rather than crashing; and, driven through a real
 * rate-limited router the way `sign-in-rate-limit.test.ts` drives its own, the
 * wrong-code budget actually refuses once spent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware, RequestHandler } from "remix/router";

import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";
import type Tenant from "~/database/tenant-do";

import { hostedDeviceShow, hostedDeviceSubmit } from "~/app/http/controllers/hosted/device";
import {
	buildHarness,
	cookieFrom,
	createTestSubjectWithPassword,
} from "~/app/http/controllers/hosted/test-harness";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import i18n from "~/app/http/middleware/i18n";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { deviceApprovalRateLimit } from "~/app/http/middleware/tenant-rate-limit";
import routes from "~/routes/tenant";

const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const PASSWORD = "correct horse battery staple";
const EMAIL = "jane@example.com";
const ISSUER = "https://tenant_1.example.com";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

/** Registers a confidential client carrying the device grant, granting the tenant's own feature first. */
async function createDeviceClient(scopes: string[] = ["openid", "profile"]) {
	await harness.tenantDO.applyEntitlements({
		plan: "pro",
		features: { device_grant: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	let result = await harness.tenantDO.registerClient({
		name: "Living Room TV",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: [DEVICE_GRANT_TYPE],
		responseTypes: [],
		scopes,
		tokenEndpointAuthMethod: "client_secret_post",
		requireConsent: false,
	});
	if (!result.ok || !result.secret) throw new Error("unreachable: client registration failed");
	return { clientId: result.client.id, clientSecret: result.secret };
}

/** Signs a subject in directly through the RPC surface, and serializes the same cookie `sign-in.tsx` would set. */
async function signIn(): Promise<{ cookie: string; sessionId: string }> {
	let signedIn = await harness.tenantDO.signInWithPassword({
		identifier: EMAIL,
		password: PASSWORD,
		remembered: false,
	});
	if (!signedIn.ok) throw new Error("unreachable: sign-in failed");

	let header = await serializeSessionCookie(signedIn, false);
	return { cookie: header.split(";")[0] ?? "", sessionId: signedIn.sessionId };
}

describe("hostedDeviceShow", () => {
	test("a session-less visit round-trips through sign-in and back to the same request", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { clientId } = await createDeviceClient();
		let begun = await harness.tenantDO.beginDeviceAuthorization({
			clientId,
			scope: "openid",
			now: Date.now(),
		});
		if (!begun.ok) throw new Error("unreachable");

		let show = await harness.router.fetch(
			harness.request(`/device?user_code=${encodeURIComponent(begun.userCode)}`),
		);
		expect(show.status).toBe(302);
		let signInLocation = new URL(show.headers.get("Location") ?? "", ISSUER);
		expect(signInLocation.pathname).toBe("/u/sign-in");
		let returnTo = signInLocation.searchParams.get("return_to");
		expect(returnTo).toBe(`/device?user_code=${begun.userCode}`);

		let signedIn = await harness.router.fetch(
			harness.request(`${signInLocation.pathname}${signInLocation.search}`, {
				method: "POST",
				body: form({ identifier: EMAIL, password: PASSWORD, remember: "true" }),
			}),
		);
		expect(signedIn.status).toBe(302);
		let backLocation = new URL(signedIn.headers.get("Location") ?? "", ISSUER);
		expect(backLocation.pathname + backLocation.search).toBe(returnTo);

		let cookie = cookieFrom(signedIn);
		let consentShown = await harness.router.fetch(
			harness.request(`${backLocation.pathname}${backLocation.search}`, { cookie }),
		);
		expect(consentShown.status).toBe(200);
		expect(await consentShown.text()).toContain("Living Room TV");
	});

	test("a live session with a valid code renders the consent screen", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { clientId } = await createDeviceClient();
		let { cookie } = await signIn();

		let begun = await harness.tenantDO.beginDeviceAuthorization({
			clientId,
			scope: "openid",
			now: Date.now(),
		});
		if (!begun.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/device?user_code=${encodeURIComponent(begun.userCode)}`, { cookie }),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Living Room TV");
	});

	test("an unknown code renders an error rather than crashing", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { cookie } = await signIn();

		let response = await harness.router.fetch(
			harness.request(`/device?user_code=ZZZZ-ZZZZ`, { cookie }),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).not.toContain("Living Room TV");
	});

	test("a plain visit with a live session and no code renders the code-entry form", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { cookie } = await signIn();

		let response = await harness.router.fetch(harness.request("/device", { cookie }));

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("user_code");
	});
});

describe("hostedDeviceSubmit", () => {
	test("approving lets a subsequent poll mint real tokens", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { clientId, clientSecret } = await createDeviceClient();
		let { cookie, sessionId } = await signIn();

		let begun = await harness.tenantDO.beginDeviceAuthorization({
			clientId,
			scope: "openid",
			now: Date.now(),
		});
		if (!begun.ok) throw new Error("unreachable");

		let approval = await harness.tenantDO.beginDeviceApproval({
			userCode: begun.userCode,
			sessionId,
			now: Date.now(),
		});
		if (!approval.ok) throw new Error("unreachable");

		let action = new URL(routes.hostedDeviceSubmit.href(), ISSUER);
		action.searchParams.set("device", approval.deviceAuthorizationId);

		let approve = await harness.router.fetch(
			harness.request(action.pathname + action.search, {
				method: "POST",
				cookie,
				body: form({ decision: "approve" }),
			}),
		);
		expect(approve.status).toBe(200);
		expect(await approve.text()).toContain("close this window");

		let polled = await harness.tenantDO.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: Date.now(),
		});

		expect(polled.kind).toBe("tokens");
	});

	test("denying lets a subsequent poll answer access_denied", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { clientId, clientSecret } = await createDeviceClient();
		let { cookie, sessionId } = await signIn();

		let begun = await harness.tenantDO.beginDeviceAuthorization({
			clientId,
			scope: "openid",
			now: Date.now(),
		});
		if (!begun.ok) throw new Error("unreachable");

		let approval = await harness.tenantDO.beginDeviceApproval({
			userCode: begun.userCode,
			sessionId,
			now: Date.now(),
		});
		if (!approval.ok) throw new Error("unreachable");

		let action = new URL(routes.hostedDeviceSubmit.href(), ISSUER);
		action.searchParams.set("device", approval.deviceAuthorizationId);

		let deny = await harness.router.fetch(
			harness.request(action.pathname + action.search, {
				method: "POST",
				cookie,
				body: form({ decision: "deny" }),
			}),
		);
		expect(deny.status).toBe(200);

		let polled = await harness.tenantDO.redeemDeviceCode({
			deviceCode: begun.deviceCode,
			clientId,
			clientSecret,
			authScheme: "post",
			now: Date.now(),
		});

		expect(polled).toMatchObject({ kind: "error", error: "access_denied" });
	});
});

/** A KV namespace double backed by a Map, for a fresh rate limit counter per test. */
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

/** Builds a router mounting `deviceApprovalRateLimit` on `/device`, the way `tenant-app.ts` wires it. */
function buildRateLimitedRouter(sessionKv: RateLimitKVNamespace, addressKv: RateLimitKVNamespace) {
	let middleware: Middleware[] = [
		tenant(() => harness.tenantDO as unknown as DurableObjectStub<Tenant>),
		render as Middleware,
		formData() as Middleware,
		i18n as Middleware,
	];
	let router = createRouter({ middleware });
	router.map(routes.hostedDeviceShow, {
		middleware: [deviceApprovalRateLimit(sessionKv, addressKv)],
		handler: hostedDeviceShow as RequestHandler,
	});
	return router;
}

describe("hostedDeviceShow under deviceApprovalRateLimit", () => {
	test("a run of wrong user codes exhausts the shared session budget", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { cookie } = await signIn();
		let router = buildRateLimitedRouter(memoryKv(), memoryKv());

		let results: number[] = [];
		for (let i = 0; i < 6; i += 1) {
			let response = await router.fetch(harness.request("/device?user_code=ZZZZ-ZZZZ", { cookie }));
			results.push(response.status);
		}

		// The budget is five per ten minutes: the first five wrong codes are each
		// answered as an ordinary unresolved code, and the sixth is refused outright.
		expect(results.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
		expect(results[5]).toBe(429);
	});

	test("a plain page load with no code spends nothing from the budget", async () => {
		await createTestSubjectWithPassword(harness.tenantDO, { email: EMAIL, password: PASSWORD });
		let { cookie } = await signIn();
		let router = buildRateLimitedRouter(memoryKv(), memoryKv());

		for (let i = 0; i < 10; i += 1) {
			let response = await router.fetch(harness.request("/device", { cookie }));
			expect(response.status).toBe(200);
		}
	});
});
