/**
 * Behavioural tests for the tenant-runtime entitlement gate: which request paths a
 * suspended tenant Durable Object must block (its OIDC/OAuth2 provider surface) versus
 * keep reachable (the Management API and the internal suspension-control endpoint), and
 * the shape of the `402` block response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { shouldBlockWhileSuspended, suspendedResponse } from "./entitlement";

describe("shouldBlockWhileSuspended", () => {
	// The provider surface must be blocked while suspended: these are exactly the paths
	// the review flagged as still forwarding to a suspended tenant DO.
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

	// The Management API stays reachable so the control plane can still inspect/manage
	// the tenant and re-run /api/setup, and the control endpoint stays reachable so the
	// suspension can be lifted.
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
