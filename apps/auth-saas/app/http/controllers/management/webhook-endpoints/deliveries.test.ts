/**
 * Drives `GET .../deliveries` and `POST .../deliveries/:deliveryId/replay`
 * through the management router.
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

/**
 * Registers an endpoint subscribed to every event type, so its own
 * registration audit event enqueues one delivery row targeting itself —
 * the shortest path to a real delivery for these tests to page and replay.
 */
async function registerEndpointWithDelivery(
	harness: Awaited<ReturnType<typeof buildWebhookEndpointsHarness>>,
): Promise<{ endpointId: string; deliveryId: string }> {
	await grantEntitlement(harness.tenantDO, "outbound_webhooks");

	let created = await harness.tenantDO.registerWebhookEndpoint({
		url: "https://example.com/webhooks/auth",
		description: "CI receiver",
		eventTypes: ["*"],
		actor: ACTOR,
	});
	if (!created.ok) throw new Error("unreachable");

	let page = await harness.tenantDO.readDeliveryPage({ endpointId: created.endpoint.id });
	if (!page.ok || page.deliveries.length === 0) throw new Error("unreachable");

	return { endpointId: created.endpoint.id, deliveryId: page.deliveries[0]!.id };
}

describe("GET /tenants/:tenantId/webhook-endpoints/:endpointId/deliveries", () => {
	test("pages the endpoint's own delivery log", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();
		let { endpointId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries`,
				token,
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ endpointId, status: "pending" });
		expect(body[0]).not.toHaveProperty("payload");
	});

	test("refuses a caller missing the webhooks:write scope", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let { endpointId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries`,
				token,
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let { endpointId } = await registerEndpointWithDelivery(harness);
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries`,
				token,
			),
		);

		expect(response.status).toBe(403);
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();
		let { endpointId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries?cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});

describe("POST /tenants/:tenantId/webhook-endpoints/:endpointId/deliveries/:deliveryId/replay", () => {
	test("writes a fresh pending delivery carrying the original's own payload", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();
		let { endpointId, deliveryId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries/${deliveryId}/replay`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ endpointId, status: "pending", replayOf: deliveryId });
		expect(body.id).not.toBe(deliveryId);
	});

	test("answers 404 for a delivery that does not exist", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();
		let { endpointId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries/whdl_missing/replay`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the webhooks:write scope", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let { endpointId, deliveryId } = await registerEndpointWithDelivery(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries/${deliveryId}/replay`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let { endpointId, deliveryId } = await registerEndpointWithDelivery(harness);
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${endpointId}/deliveries/${deliveryId}/replay`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});
});
