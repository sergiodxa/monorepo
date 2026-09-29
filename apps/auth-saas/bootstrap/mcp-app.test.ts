/**
 * The platform's MCP server end to end: the generated tools publish each operation's own
 * params, query and body schemas; a call reaches the real `subjectsList` action over a
 * seeded tenant Durable Object, with parsed query and body values forwarded in the form
 * the route reads back; an unverified caller is refused before any request is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONSchema } from "@sdxc/json-schema";
import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
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

/** Spies on every forwarded request the dispatch module was asked to send. */
let dispatchCalls: Request[];

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

/** A `tools/call` JSON-RPC request against the MCP endpoint, carrying every header this revision requires. */
function callToolRequest(name: string, args: Record<string, unknown>, token?: string): Request {
	let headers = new Headers({
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": "tools/call",
		"Mcp-Name": name,
	});
	if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

	return new Request("https://auth.example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name,
				arguments: args,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** A `tools/list` JSON-RPC request, carrying every header this revision requires. */
function listToolsRequest(token?: string): Request {
	let headers = new Headers({
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": "tools/list",
	});
	if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);

	return new Request("https://auth.example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list",
			params: {
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
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

	dispatchCalls = [];
	useManagementDispatchForTesting((request) => {
		dispatchCalls.push(request);
		return managementActionRouter.fetch(request);
	});
});

/** One `tools/list` entry, reduced to what these tests read. */
interface ListedTool {
	name: string;
	inputSchema: JSONSchema;
}

/** Lists the tools a valid machine token sees. */
async function listTools(): Promise<ListedTool[]> {
	let response = await mcpRouter.fetch(listToolsRequest(await signMachineToken()));
	expect(response.status).toBe(200);

	let body = (await response.json()) as { result?: { tools?: ListedTool[] } };
	return body.result?.tools ?? [];
}

/** The input schema one listed tool publishes, failing the test when the tool is absent. */
async function inputSchemaOf(name: string): Promise<JSONSchema> {
	let listed = (await listTools()).find((each) => each.name === name);
	if (listed === undefined) throw new Error(`${name} is not listed`);
	return listed.inputSchema;
}

describe("tools/list", () => {
	test("is non-empty and includes recognizable management operations", async () => {
		let names = (await listTools()).map((each) => each.name);

		expect(names.length).toBeGreaterThan(0);
		expect(names).toEqual(
			expect.arrayContaining(["subjectsList", "subjectsCreate", "clientsList"]),
		);
	});

	test("nests params and query, requiring only the parts whose keys are required", async () => {
		let schema = await inputSchemaOf("subjectsList");

		expect(schema.required).toEqual(["params"]);
		expect(schema.properties?.params).toEqual({
			type: "object",
			properties: { tenantId: { type: "string" } },
			required: ["tenantId"],
		});
		expect(schema.properties?.query?.properties?.per_page?.type).toEqual(["number", "string"]);
		expect(schema.properties?.body).toBeUndefined();
	});

	test("publishes a body using a record, a union and nullable members as its real schema", async () => {
		let schema = await inputSchemaOf("subjectsCreate");
		let body = schema.properties?.body;

		expect(body?.type).toBe("object");
		expect(body?.properties?.attributes).toEqual({ type: "object", additionalProperties: {} });
		expect(body?.properties?.profile?.properties?.name).toEqual({ type: ["string", "null"] });

		let patch = (await inputSchemaOf("subjectsUpdate")).properties?.body;
		expect(patch?.properties?.attributes).toEqual({
			anyOf: [
				{
					type: "object",
					additionalProperties: {
						anyOf: [
							{ anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
							{ type: "null" },
						],
					},
				},
				{ type: "null" },
			],
		});
	});
});

describe("tools/call", () => {
	test("a valid bearer token reaches the real subjectsList action and returns its real data", async () => {
		let token = await signMachineToken();

		let response = await mcpRouter.fetch(
			callToolRequest("subjectsList", { params: { tenantId } }, token),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as {
			result: { isError?: boolean; content: { type: string; text: string }[] };
		};
		expect(body.result.isError).toBeFalsy();
		expect(dispatchCalls).toHaveLength(1);

		let subjects = JSON.parse(body.result.content[0]?.text ?? "[]") as { id: string }[];
		expect(subjects.map((subject) => subject.id)).toContain(subjectId);
	});

	test("forwards a coerced query value as the text the route reads back", async () => {
		let token = await signMachineToken();

		let response = await mcpRouter.fetch(
			callToolRequest(
				"subjectsList",
				{ params: { tenantId }, query: { per_page: "1", status: "active" } },
				token,
			),
		);
		let body = (await response.json()) as { result: { isError?: boolean } };

		expect(body.result.isError).toBeFalsy();
		let forwarded = new URL(dispatchCalls[0]?.url ?? "");
		expect(forwarded.pathname).toBe(`/tenants/${tenantId}/subjects`);
		expect(forwarded.searchParams.get("per_page")).toBe("1");
		expect(forwarded.searchParams.get("status")).toBe("active");
		expect(forwarded.searchParams.has("cursor")).toBe(false);
	});

	test("forwards the parsed body as JSON, keeping nulls the schema accepts", async () => {
		let forwarded: { method: string; url: string; contentType: string | null; body: string }[] = [];
		useManagementDispatchForTesting(async (request) => {
			forwarded.push({
				method: request.method,
				url: request.url,
				contentType: request.headers.get("Content-Type"),
				body: await request.text(),
			});
			return Response.json({ subjectId: "sub_1", identifiers: [] }, { status: 201 });
		});

		let response = await mcpRouter.fetch(
			callToolRequest(
				"subjectsCreate",
				{
					params: { tenantId },
					body: {
						profile: { name: null, givenName: "Jane" },
						attributes: { tier: "gold" },
						unknown: true,
					},
				},
				await signMachineToken(),
			),
		);
		let body = (await response.json()) as { result: { isError?: boolean } };

		expect(body.result.isError).toBeFalsy();
		expect(forwarded).toHaveLength(1);
		expect(forwarded[0]?.method).toBe("POST");
		expect(new URL(forwarded[0]?.url ?? "").pathname).toBe(`/tenants/${tenantId}/subjects`);
		expect(forwarded[0]?.contentType).toBe("application/json");
		expect(JSON.parse(forwarded[0]?.body ?? "null")).toEqual({
			profile: { name: null, givenName: "Jane" },
			attributes: { tier: "gold" },
		});
	});

	test("refuses arguments outside the nested shape before any request is forwarded", async () => {
		let response = await mcpRouter.fetch(
			callToolRequest("subjectsList", { tenantId }, await signMachineToken()),
		);
		let body = (await response.json()) as { error?: { data?: { issues?: string[] } } };

		expect(body.error?.data?.issues).toEqual(["params: Required"]);
		expect(dispatchCalls).toHaveLength(0);
	});

	test("refuses a request with no bearer token before any request is forwarded", async () => {
		let response = await mcpRouter.fetch(callToolRequest("subjectsList", { params: { tenantId } }));

		expect(response.status).toBe(401);
		expect(dispatchCalls).toHaveLength(0);
	});

	test("refuses a bearer token that does not verify before any request is forwarded", async () => {
		let response = await mcpRouter.fetch(
			callToolRequest("subjectsList", { params: { tenantId } }, "not-a-real-token"),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
		expect(dispatchCalls).toHaveLength(0);
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
