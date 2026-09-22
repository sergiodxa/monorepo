/**
 * Drives `POST /tenants/:tenantId/webhook-endpoints` through the management
 * router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildWebhookEndpointsHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/webhook-endpoints/test-harness";

/** The body `POST /tenants/:tenantId/webhook-endpoints` accepts when a test does not care about most of it. */
function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		url: "https://example.com/webhooks/auth",
		description: "CI receiver",
		eventTypes: ["*"],
		...overrides,
	};
}

describe("POST /tenants/:tenantId/webhook-endpoints", () => {
	test("registers an endpoint and mints its first signing secret", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.endpoint).toMatchObject({ url: "https://example.com/webhooks/auth" });
		expect(body.secret).toMatch(/^whsec_/);
	});

	test("answers a problem+json validation failure for an insecure URL", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody({ url: "http://example.com/webhooks/auth" })),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-url");
	});

	test("answers a problem+json validation failure for an unknown event type", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody({ eventTypes: ["not-a-real-event"] })),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/unknown-event-type");
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify({ description: "Missing Fields" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test("answers a problem+json entitlement failure distinct from a scope refusal", async () => {
		let harness = await buildWebhookEndpointsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("refuses a caller missing the webhooks:write scope", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildWebhookEndpointsHarness();
		await grantEntitlement(harness.tenantDO, "outbound_webhooks");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/webhook-endpoints`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(403);
	});
});
