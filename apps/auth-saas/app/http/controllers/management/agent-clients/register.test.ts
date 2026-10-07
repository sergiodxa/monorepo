/**
 * Drives `POST /tenants/:tenantId/agent-clients` through the management router,
 * for a bearer caller and for a dashboard member alike: a credential is minted
 * only within the scopes its registering caller already holds at the tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { createR2Bucket } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";

import { createAgentClientsRegisterAction } from "~/app/http/controllers/management/agent-clients/register";
import {
	buildManagementTestCore,
	conformance,
	fakeHostnameClient,
	fakeLimiter,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import AgentClientBinding from "~/app/models/agent-client-binding";
import routes from "~/routes/management";

/** The provisioned tenant, and a router mapping only the registration route, resolving a dashboard session to `dashboardSubjectId`. */
async function buildHarness(dashboardSubjectId: string | null = null) {
	let core = await buildManagementTestCore({ defaultScope: "clients:write" });

	let router = createRouter({ middleware: [conformance, database(() => core.db)] });
	router.map(
		routes.agentClientsRegister,
		createAgentClientsRegisterAction({
			issuer: ISSUER,
			resolveDashboardSubjectId: async (_ctx: RequestContext) => dashboardSubjectId,
			limiter: fakeLimiter(),
			resolveStub: () => {
				throw new Error("unreachable: agent-client registration reaches no tenant object");
			},
			hostnameClient: fakeHostnameClient,
			r2: createR2Bucket(),
		}),
	);

	return { ...core, router };
}

/** A registration request body asking for `scopes`. */
function registration(scopes: string[]): RequestInit {
	return { method: "POST", body: JSON.stringify({ name: "CI bot", scopes }) };
}

/** A registration request carrying no bearer token, so the dashboard session resolves the caller. */
function dashboardRequest(core: ManagementTestCore, scopes: string[]): Request {
	return new Request(`${ISSUER}/tenants/${core.tenantId}/agent-clients`, {
		...registration(scopes),
		headers: { "Content-Type": "application/json" },
	});
}

describe("POST /tenants/:tenantId/agent-clients", () => {
	test("registers a credential within the scopes its caller holds", async () => {
		let harness = await buildHarness();
		let token = await harness.signToken({ scope: "clients:write subjects:read" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/agent-clients`,
				token,
				registration(["subjects:read"]),
			),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as { clientId: string };
		let binding = await AgentClientBinding.findByClientId(harness.db, body.clientId);
		expect(binding?.tenant_id).toBe(harness.tenantId);
	});

	test("refuses a bearer caller a scope its own token does not carry", async () => {
		let harness = await buildHarness();
		let token = await harness.signToken({ scope: "clients:write" });
		let before = await AgentClientBinding.listByTenantId(harness.db, harness.tenantId);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/agent-clients`,
				token,
				registration(["clients:write", "members:write"]),
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { type: string; detail: string };
		expect(body.type).toBe("https://docs.example.com/errors/scope-not-held");
		expect(body.detail).toContain("members:write");
		expect(await AgentClientBinding.listByTenantId(harness.db, harness.tenantId)).toEqual(before);
	});

	test("refuses a dashboard admin the owner-only scopes its role never carries", async () => {
		let harness = await buildHarness("sub_admin");
		await grantMembership(harness.db, harness.tenantId, "sub_admin", "admin");

		for (let scope of ["members:write", "tenant:write"]) {
			let response = await harness.router.fetch(
				dashboardRequest(harness, ["clients:write", scope]),
			);

			expect(response.status).toBe(400);
			let body = (await response.json()) as { type: string };
			expect(body.type).toBe("https://docs.example.com/errors/scope-not-held");
		}

		expect(await AgentClientBinding.listByTenantId(harness.db, harness.tenantId)).toEqual([]);
	});

	test("lets a dashboard owner mint any scope its role carries", async () => {
		let harness = await buildHarness("sub_owner");
		await grantMembership(harness.db, harness.tenantId, "sub_owner", "owner");

		let response = await harness.router.fetch(
			dashboardRequest(harness, ["members:write", "tenant:write"]),
		);

		expect(response.status).toBe(201);
	});
});
