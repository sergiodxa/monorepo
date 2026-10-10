/**
 * Drives `POST /tenants/:tenantId/members/invite` through the management router:
 * a valid invite mints a row and sends exactly one email carrying a token-bearing
 * link, a caller missing `members:write` is refused, a second invitation to the
 * same address supersedes the first, and the response never carries the plaintext
 * token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";
import { bindModels } from "~/app/test/models";

describe("POST /tenants/:tenantId/members/invite", () => {
	test("mints an invitation and emails a token-bearing accept link", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/invite`, token, {
				method: "POST",
				body: JSON.stringify({ email: "Jane.Doe@Example.com", role: "admin" }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toHaveProperty("id");
		expect(body).toHaveProperty("expiresAt");
		expect(body).not.toHaveProperty("token");

		expect(harness.mailTransport.messages).toHaveLength(1);
		let sent = harness.mailTransport.messages[0];
		expect(sent?.to).toEqual([{ email: "Jane.Doe@Example.com" }]);
		expect(String(sent?.html)).toContain("invitations/accept?token=");

		let stored = await bindModels(harness.db)
			.tenantMemberInvitations.pendingFor(harness.tenantId, "jane.doe@example.com")
			.first();
		expect(stored).toMatchObject({ id: body.id, role: "admin", accepted_at: null });
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/invite`, token, {
				method: "POST",
				body: JSON.stringify({ email: "jane@example.com", role: "admin" }),
			}),
		);

		expect(response.status).toBe(403);
		expect(harness.mailTransport.messages).toHaveLength(0);
	});

	test("supersedes a prior open invitation to the same address instead of piling up", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let first = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/invite`, token, {
				method: "POST",
				body: JSON.stringify({ email: "jane@example.com", role: "member" }),
			}),
		);
		let firstBody = (await first.json()) as Record<string, unknown>;

		let second = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/invite`, token, {
				method: "POST",
				body: JSON.stringify({ email: "jane@example.com", role: "admin" }),
			}),
		);
		let secondBody = (await second.json()) as Record<string, unknown>;

		expect(second.status).toBe(201);
		expect(secondBody.id).not.toBe(firstBody.id);

		let pending = await bindModels(harness.db)
			.tenantMemberInvitations.pendingFor(harness.tenantId, "jane@example.com")
			.first();
		expect(pending).toMatchObject({ id: secondBody.id, role: "admin" });

		expect(harness.mailTransport.messages).toHaveLength(2);
	});
});
