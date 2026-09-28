/**
 * The MCP endpoint end to end: a `tools/call` presenting a valid bearer token reaches
 * the real `subjectsList` management action — mounted here the same way
 * `management-auth.test.ts` and `management-rate-limit.test.ts` mount one real action
 * apiece, over a real tenant Durable Object seeded with a real subject — and returns
 * that route's real data; no token, or one that does not verify, is refused before any
 * such request is ever built; and the protected-resource metadata names the platform
 * tenant's own issuer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { createSubjectsListAction } from "~/app/http/controllers/management/subjects/list";
import { database } from "~/app/http/middleware/database";
import { usePlatformTenantForTesting } from "~/app/lib/platform-tenant";
import { useManagementDispatchForTesting } from "~/app/mcp/dispatch";
import AgentClientBinding from "~/app/models/agent-client-binding";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";
import { mcpRouter } from "~/bootstrap/mcp-app";
import TenantObject from "~/database/tenant-do";
import routes from "~/routes/management";

const PLATFORM_ISSUER = "https://platform.example.com";

let db: Database;
let tenantId: string;
let platformTenantDO: TenantObject;
let tenantDO: TenantObject;
let subjectId: string;

/** A rate limiter that always allows, standing in for `MANAGEMENT_RATE_LIMITER`. */
function allowingLimiter(): RateLimiterBinding {
	return { limit: async () => ({ success: true }) };
}

/** Registers a machine client on the platform tenant, bound to `tenantId`, and mints its token. */
async function signMachineToken(scope = "subjects:read"): Promise<string> {
	let registered = await platformTenantDO.registerClient({
		name: "mcp agent",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: ["client_credentials"],
		responseTypes: [],
		scopes: ["subjects:read"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!registered.ok || registered.secret === null) throw new Error("unreachable");

	await AgentClientBinding.create(db, { clientId: registered.client.id, tenantId });

	let outcome = await platformTenantDO.issueClientCredentialsToken({
		clientId: registered.client.id,
		clientSecret: registered.secret,
		scope,
		resource: null,
		authScheme: "basic",
		now: Date.now(),
	});
	if (outcome.kind !== "tokens") throw new Error("unreachable");
	return outcome.accessToken;
}

/** A `tools/call` JSON-RPC request against the MCP endpoint. */
function callToolRequest(name: string, args: Record<string, unknown>, token?: string): Request {
	let headers = new Headers({
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream",
	});
	if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

	return new Request("https://auth.example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name, arguments: args },
		}),
	});
}

beforeEach(async () => {
	db = await createTestDatabase();
	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});
	tenantId = tenant.id;

	let platformState = createDurableObjectState();
	platformTenantDO = new TenantObject(platformState, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await platformTenantDO.provision({ tenantId: "platform", issuer: PLATFORM_ISSUER });
	await platformTenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
	usePlatformTenantForTesting(
		() => platformTenantDO as unknown as DurableObjectStub<TenantObject>,
		PLATFORM_ISSUER,
	);

	let tenantState = createDurableObjectState();
	tenantDO = new TenantObject(tenantState, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await tenantDO.provision({ tenantId, issuer: "https://acme.auth.example.com" });
	let created = await tenantDO.createSubject({
		identifiers: [{ kind: "username", value: "jane" }],
	});
	if (!created.ok) throw new Error("unreachable");
	subjectId = created.subjectId;

	let managementActionRouter = createRouter({ middleware: [database(() => db)] });
	managementActionRouter.map(
		routes.subjectsList,
		createSubjectsListAction({
			issuer: "https://api.example.com",
			resolveDashboardSubjectId: async () => null,
			limiter: allowingLimiter(),
			resolveStub: () => tenantDO as unknown as DurableObjectStub<TenantObject>,
			hostnameClient: () => {
				throw new Error("not needed for subjectsList");
			},
			r2: {} as R2Bucket,
		}),
	);

	useManagementDispatchForTesting((request) => managementActionRouter.fetch(request));
});

describe("tools/call", () => {
	test("a valid bearer token reaches the real subjectsList action and returns its real data", async () => {
		let token = await signMachineToken();

		let response = await mcpRouter.fetch(callToolRequest("subjectsList", { tenantId }, token));
		expect(response.status).toBe(200);

		let body = (await response.json()) as {
			result: { isError: boolean; content: { type: string; text: string }[] };
		};
		expect(body.result.isError).toBe(false);

		let subjects = JSON.parse(body.result.content[0]?.text ?? "[]") as { id: string }[];
		expect(subjects.map((subject) => subject.id)).toContain(subjectId);
	});

	test("refuses a request with no bearer token before any request is forwarded", async () => {
		let response = await mcpRouter.fetch(callToolRequest("subjectsList", { tenantId }));

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain(
			'resource_metadata="https://test-platform_domain/.well-known/oauth-protected-resource"',
		);
	});

	test("refuses a bearer token that does not verify before any request is forwarded", async () => {
		let response = await mcpRouter.fetch(
			callToolRequest("subjectsList", { tenantId }, "not-a-real-token"),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
	});
});

describe("protected-resource metadata", () => {
	test("names the platform tenant's own issuer as its authorization server", async () => {
		let response = await mcpRouter.fetch(
			new Request("https://auth.example.com/.well-known/oauth-protected-resource"),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { authorization_servers: string[] };
		expect(body.authorization_servers).toEqual([new URL(PLATFORM_ISSUER).href]);
	});
});
