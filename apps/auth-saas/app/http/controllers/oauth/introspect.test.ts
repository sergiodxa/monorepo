/**
 * Drives `/api-keys/introspect` through the tenant router, minting a real API
 * key through the tenant object the way `token.test.ts` mints a real token,
 * so the test exercises the actual client-authentication and key-resolution
 * path rather than the DO methods alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64 } from "@sdxc/crypto";
import { generateUUID } from "@sdxc/uuid/v4";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import Tenant from "~/database/tenant-do";
import routes from "~/routes/tenant";

import introspect from "./introspect";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";
const ACTOR = { type: "platform" as const, id: "system" };

let tenantDO: Tenant;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
});

/** Builds a tenant router wired to the constructed Durable Object. */
function buildRouter() {
	let router = createRouter({
		middleware: [tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>)],
	});
	router.map(routes.apiKeysIntrospect, introspect);
	return router;
}

/** A `POST /api-keys/introspect` request already resolved to the fixture tenant. */
function introspectRequest(
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): Request {
	let requestHeaders = new Headers(headers);
	requestHeaders.set(TENANT_ID_HEADER, TENANT_ID);
	requestHeaders.set(TENANT_REGION_HEADER, "wnam");
	requestHeaders.set(TENANT_ISSUER_HEADER, ISSUER);
	requestHeaders.set("Content-Type", "application/json");

	return new Request(`https://${TENANT_ID}.example.com/api-keys/introspect`, {
		method: "POST",
		headers: requestHeaders,
		body: JSON.stringify(body),
	});
}

/** Registers a confidential client, throwing if the record was refused. */
async function createTestClient() {
	let result = await tenantDO.registerClient({
		name: "Tenant Backend",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: [],
		responseTypes: [],
		scopes: [],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

/** Mints a ready-to-use API key for a fresh subject, granting the tenant's own machine_access feature first. */
async function createTestApiKey(input: { expiresAt?: number } = {}): Promise<{
	value: string;
	subjectId: string;
	keyId: string;
}> {
	await tenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
	await tenantDO.setApiKeyPrefix({ prefix: "acme", actor: ACTOR });

	let created = await tenantDO.createSubject({
		identifiers: [{ kind: "username", value: `svc-${generateUUID()}` }],
	});
	if (!created.ok) throw new Error("unreachable");

	let minted = await tenantDO.createApiKey({
		subjectId: created.subjectId,
		name: "Backend integration",
		scopes: [],
		actor: ACTOR,
		...input,
	});
	if (!minted.ok) throw new Error("unreachable");

	return { value: minted.value, subjectId: created.subjectId, keyId: minted.key.id };
}

describe("a valid key", () => {
	test("answers active with the resolved subject, scope and expiry", async () => {
		let { client, secret } = await createTestClient();
		let { value, subjectId } = await createTestApiKey();

		let response = await buildRouter().fetch(
			introspectRequest(
				{ token: value },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toEqual({ active: true, sub: subjectId, scope: "", exp: expect.any(Number) });
	});
});

describe("a key that does not verify", () => {
	test("a malformed value answers active: false", async () => {
		let { client, secret } = await createTestClient();

		let response = await buildRouter().fetch(
			introspectRequest(
				{ token: "not-a-key" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });
	});

	test("an expired key answers active: false", async () => {
		let { client, secret } = await createTestClient();
		let { value } = await createTestApiKey({ expiresAt: Date.now() - 1000 });

		let response = await buildRouter().fetch(
			introspectRequest(
				{ token: value },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });
	});

	test("a revoked key answers active: false", async () => {
		let { client, secret } = await createTestClient();
		let { value, keyId } = await createTestApiKey();
		await tenantDO.revokeApiKey({ keyId, reason: "no longer needed", actor: ACTOR });

		let response = await buildRouter().fetch(
			introspectRequest(
				{ token: value },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });
	});
});

describe("the caller's own authentication", () => {
	test("a wrong client secret is invalid_client at 401", async () => {
		let { client } = await createTestClient();
		let { value } = await createTestApiKey();

		let response = await buildRouter().fetch(
			introspectRequest(
				{ token: value },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:wrong-secret`)}` },
			),
		);

		expect(response.status).toBe(401);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});

	test("presenting no credentials at all is invalid_client", async () => {
		let { client } = await createTestClient();
		let { value } = await createTestApiKey();

		let response = await buildRouter().fetch(
			introspectRequest({ token: value, client_id: client.id }),
		);

		expect(response.status).toBe(401);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});
});
