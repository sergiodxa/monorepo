/**
 * Behavioural tests for the tenant-runtime entitlement gate: which request paths a
 * suspended tenant Durable Object must block (its OIDC/OAuth2 provider surface) versus
 * keep reachable (the Management API and the internal suspension-control endpoint), and
 * the shape of the `402` block response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { shouldBlockWhileSuspended, suspendedResponse } from "./entitlement";

describe("shouldBlockWhileSuspended", () => {
	for (let path of [
		"/authorize",
		"/oauth/token",
		"/oauth/revoke",
		"/oauth/introspect",
		"/userinfo",
		"/oidc/logout",
		"/webauthn/register/options",
		"/webauthn/auth/verify",
		"/.well-known/openid-configuration",
		"/.well-known/jwks.json",
		"/verify-email",
		"/magic-link/consume",
		"/",
	]) {
		test(`blocks the provider path ${path}`, () => {
			expect(shouldBlockWhileSuspended(path)).toBe(true);
		});
	}

	for (let path of [
		"/api/setup",
		"/api/stats",
		"/api/clients",
		"/api/subjects/abc/sessions",
		"/__control/suspend",
	]) {
		test(`keeps the operational path ${path} reachable`, () => {
			expect(shouldBlockWhileSuspended(path)).toBe(false);
		});
	}
});

describe("suspendedResponse", () => {
	test("returns a 402 JSON tenant_suspended response", async () => {
		let response = suspendedResponse();
		expect(response.status).toBe(402);
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(await response.json()).toEqual({ error: "tenant_suspended" });
	});
});
