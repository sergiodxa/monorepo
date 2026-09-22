/**
 * Drives `POST /tenants/:tenantId/session-policy` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { TenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";

import {
	buildTenantsHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/tenants/test-harness";
import TenantEntitlement from "~/app/models/tenant-entitlement";

/**
 * Grants the `session_policy` feature on both layers a real subscription
 * would: the control-plane projection the Worker-level entitlement gate
 * reads, and the tenant object's own copy `setSessionPolicy` reads for its
 * tighten-only comparison.
 */
async function grantSessionPolicyEntitlement(harness: TenantsHarness): Promise<void> {
	await TenantEntitlement.upsert(harness.db, harness.tenantId, {
		products: ["pro"],
		features: { session_policy: true },
		readAt: Date.now(),
	});
	await grantEntitlement(harness.tenantDO, "session_policy");
}

describe("POST /tenants/:tenantId/session-policy", () => {
	test("writes a valid policy and answers the stored policy and sessions shortened", async () => {
		let harness = await buildTenantsHarness();
		await grantSessionPolicyEntitlement(harness);
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: { absoluteLifetimeMs: 60 * 60 * 1000 } }),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			policy: { sessionAbsoluteLifetimeMs: 60 * 60 * 1000 },
			sessionsShortened: 0,
		});
	});

	test("refuses a caller whose tenant holds no session_policy entitlement", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: { absoluteLifetimeMs: 60 * 60 * 1000 } }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses an out-of-bounds value with the field and message", async () => {
		let harness = await buildTenantsHarness();
		await grantSessionPolicyEntitlement(harness);
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: { absoluteLifetimeMs: 1000 } }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		let body = (await response.json()) as {
			errors: Array<{ pointer: string; message: string }>;
		};
		expect(body.errors[0]?.pointer).toBe("/policy/absoluteLifetimeMs");
		expect(body.errors[0]?.message).toContain("absoluteLifetimeMs");
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		await grantSessionPolicyEntitlement(harness);
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: { absoluteLifetimeMs: 60 * 60 * 1000 } }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
