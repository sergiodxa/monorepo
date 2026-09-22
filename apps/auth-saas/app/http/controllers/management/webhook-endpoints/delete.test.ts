/**
 * Drives `DELETE /tenants/:tenantId/webhook-endpoints/:endpointId` through
 * the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

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

describe("DELETE /tenants/:tenantId/webhook-endpoints/:endpointId", () => {
	test("deletes an endpoint outright", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(204);

		let read = await harness.tenantDO.readWebhookEndpoint({ endpointId: created.endpoint.id });
		expect(read).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("answers 404 for an endpoint the tenant does not hold", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints/whep_missing`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the webhooks:write scope", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});
});
