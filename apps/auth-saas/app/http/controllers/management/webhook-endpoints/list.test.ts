/**
 * Drives `GET /tenants/:tenantId/webhook-endpoints` through the management
 * router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { AuditActor } from "~/database/audit-events";

import {
	buildWebhookEndpointsHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/webhook-endpoints/test-harness";

let ACTOR: AuditActor = { type: "platform", id: "system" };

/** The record `registerWebhookEndpoint` accepts when a test does not care about most of it. */
function baseInput(overrides: Record<string, unknown> = {}) {
	return {
		url: "https://example.com/webhooks/auth",
		description: "CI receiver",
		eventTypes: ["*"],
		actor: ACTOR,
		...overrides,
	};
}

describe("GET /tenants/:tenantId/webhook-endpoints", () => {
	test("pages the tenant's own endpoints, newest first", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		await harness.tenantDO.registerWebhookEndpoint(baseInput({ description: "First" }));

		vi.setSystemTime(1_700_000_000_000 + 1000);
		await harness.tenantDO.registerWebhookEndpoint(baseInput({ description: "Second" }));
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints?per_page=1`, token),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ description: "Second" });
	});

	test("refuses a caller missing the webhooks:write scope", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token),
		);

		expect(response.status).toBe(403);
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints?cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
