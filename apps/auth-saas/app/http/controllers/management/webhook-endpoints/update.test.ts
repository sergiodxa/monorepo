/**
 * Drives `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId` through the
 * management router.
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

/** The body `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId` accepts when a test does not care about most of it. */
function updateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		url: "https://example.com/webhooks/auth",
		description: "CI receiver",
		eventTypes: ["*"],
		...overrides,
	};
}

describe("PATCH /tenants/:tenantId/webhook-endpoints/:endpointId", () => {
	test("replaces the whole editable record in one call", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{
					method: "PATCH",
					body: JSON.stringify(updateBody({ description: "Renamed receiver" })),
				},
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ description: "Renamed receiver" });
	});

	test("applies a merge patch naming only what changes", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/merge-patch+json" },
					body: JSON.stringify({ eventTypes: ["subject.created"] }),
				},
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			url: "https://example.com/webhooks/auth",
			description: "CI receiver",
			eventTypes: ["subject.created"],
		});
	});

	test("answers 404 for an endpoint the tenant does not hold", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints/whep_missing`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody()),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for an invalid URL", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{
					method: "PATCH",
					body: JSON.stringify(updateBody({ url: "not-a-url" })),
				},
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-url");
	});

	test("answers a problem+json entitlement failure distinct from a scope refusal", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerWebhookEndpoint(baseInput());
		if (!created.ok) throw new Error("unreachable");

		// The entitlement lapses between registration and this update call.
		await harness.tenantDO.applyEntitlements({
			plan: "free",
			features: { outbound_webhooks: false },
			dauCap: null,
			auditRetentionDays: null,
			effectiveAt: Date.now(),
		});

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/webhook-endpoints/${created.endpoint.id}`,
				token,
				{
					method: "PATCH",
					body: JSON.stringify(updateBody()),
				},
			),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
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
				{
					method: "PATCH",
					body: JSON.stringify(updateBody()),
				},
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
				{
					method: "PATCH",
					body: JSON.stringify(updateBody()),
				},
			),
		);

		expect(response.status).toBe(403);
	});
});
