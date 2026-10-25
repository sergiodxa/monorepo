/**
 * Drives `/oauth/introspect` through the tenant router against tokens minted by a real
 * code exchange: the RFC 7662 JSON answer, the RFC 9701 signed answer an `Accept` header
 * asks for, and the refusals and inactive answers a caller can meet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64, Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { Database } from "remix/data-table";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import { authorizationCodes } from "~/app/models/tenant/authorization";
import { IntrospectionResponse } from "~/app/models/tenant/introspection";
import Tenant from "~/app/models/tenant/object";
import { openSession } from "~/app/models/tenant/sessions";
import routes from "~/routes/tenant";

import token from "./token";
import tokenIntrospection, { acceptsSignedIntrospection } from "./token-introspection";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";
const REDIRECT_URI = "https://example.com/callback";

let tenantDO: Tenant;
let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
	db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
});

/** A tenant router serving the token and introspection endpoints. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.token, token);
	router.map(routes.tokenIntrospection, tokenIntrospection);
	return router;
}

/** A form `POST` to one of the tenant's endpoints. */
function post(path: string, form: Record<string, string>, headers: Record<string, string> = {}) {
	let resolved = new Headers(headers);
	resolved.set("Content-Type", "application/x-www-form-urlencoded");
	resolved.set(TENANT_ID_HEADER, TENANT_ID);
	resolved.set(TENANT_REGION_HEADER, "wnam");
	resolved.set(TENANT_ISSUER_HEADER, ISSUER);
	return new Request(`https://${TENANT_ID}.example.com${path}`, {
		method: "POST",
		headers: resolved,
		body: new URLSearchParams(form).toString(),
	});
}

/** Registers a confidential client, answering its id and `Basic` credentials. */
async function createClient() {
	let result = await tenantDO.registerClient({
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		scopes: ["openid", "offline_access"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return {
		clientId: result.client.id,
		basic: `Basic ${Base64.encode(`${result.client.id}:${result.secret ?? ""}`)}`,
	};
}

/** An access and a refresh token issued to `client` by a real code exchange. */
async function issueTokens(client: { clientId: string; basic: string }) {
	let created = await tenantDO.createSubject({
		identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
	});
	if (!created.ok) throw new Error("unreachable");
	let session = await openSession(db, {
		subjectId: created.subjectId,
		amr: ["pwd"],
		remembered: true,
	});

	let code = `code-${generateUUID()}`;
	let codeVerifier = `verifier-${generateUUID()}`;
	let codeHashed = await sha256(code);
	let verifierHashed = await sha256(codeVerifier);
	if (isFailure(codeHashed) || isFailure(verifierHashed)) throw new Error("unreachable");
	let now = Date.now();
	await db.create(authorizationCodes, {
		id: generateUUID(),
		code_hash: Hex.encode(codeHashed.data),
		client_id: client.clientId,
		redirect_uri: REDIRECT_URI,
		code_challenge: Base64Url.encode(verifierHashed.data),
		scopes: ["openid", "offline_access"],
		subject_id: created.subjectId,
		session_id: session.sessionId,
		nonce: null,
		auth_time: now,
		created_at: now,
		expires_at: now + 60_000,
		redeemed_at: null,
		token_family_id: null,
	});

	let response = await buildRouter().fetch(
		post(
			"/oauth/token",
			{
				grant_type: "authorization_code",
				code,
				code_verifier: codeVerifier,
				redirect_uri: REDIRECT_URI,
			},
			{ Authorization: client.basic },
		),
	);
	let body = (await response.json()) as { access_token: string; refresh_token: string };
	return { subjectId: created.subjectId, ...body };
}

/** Introspects a token as `client`, with any extra headers. */
async function introspect(
	client: { basic: string },
	form: Record<string, string>,
	headers: Record<string, string> = {},
): Promise<Response> {
	return await buildRouter().fetch(
		post("/oauth/introspect", form, { Authorization: client.basic, ...headers }),
	);
}

describe("POST /oauth/introspect", () => {
	test("describes an active access token", async () => {
		let client = await createClient();
		let tokens = await issueTokens(client);

		let response = await introspect(client, { token: tokens.access_token });

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toMatchObject({
			active: true,
			sub: tokens.subjectId,
			client_id: client.clientId,
			iss: ISSUER,
			scope: "openid offline_access",
			token_type: "Bearer",
			auth_time: expect.any(Number),
		});
	});

	test("answers an unknown token as inactive and nothing more", async () => {
		let client = await createClient();

		let response = await introspect(client, { token: "not-a-token" });

		expect(await response.json()).toEqual({ active: false });
	});

	test("describes a refresh token to the client it was issued to", async () => {
		let client = await createClient();
		let tokens = await issueTokens(client);

		let response = await introspect(client, {
			token: tokens.refresh_token,
			token_type_hint: "refresh_token",
		});

		expect(await response.json()).toMatchObject({
			active: true,
			client_id: client.clientId,
			token_type: "refresh_token",
		});
	});

	test("answers another client's refresh token as inactive", async () => {
		let owner = await createClient();
		let other = await createClient();
		let tokens = await issueTokens(owner);

		let response = await introspect(other, { token: tokens.refresh_token });

		expect(await response.json()).toEqual({ active: false });
	});

	test("signs the answer for a caller that accepts token-introspection+jwt", async () => {
		let client = await createClient();
		let tokens = await issueTokens(client);

		let response = await introspect(
			client,
			{ token: tokens.access_token },
			{ Accept: "application/token-introspection+jwt" },
		);

		expect(response.headers.get("Content-Type")).toBe("application/token-introspection+jwt");
		let metadata = await tenantDO.publishMetadata({ now: Date.now() });
		let signed = await IntrospectionResponse.verify(
			await response.text(),
			await JWK.importLocal(metadata.jwks),
			{ issuer: ISSUER, audience: client.clientId },
		);
		expect(signed.payload.token_introspection).toMatchObject({
			active: true,
			sub: tokens.subjectId,
		});
	});

	test("signs an inactive answer too", async () => {
		let client = await createClient();

		let response = await introspect(
			client,
			{ token: "not-a-token" },
			{ Accept: "application/token-introspection+jwt" },
		);

		let signed = IntrospectionResponse.decode(await response.text());
		expect(signed.payload.token_introspection).toEqual({ active: false });
	});

	test("refuses a caller that does not authenticate", async () => {
		let client = await createClient();
		let response = await buildRouter().fetch(
			post("/oauth/introspect", { token: "x", client_id: client.clientId }),
		);

		expect(response.status).toBe(401);
	});

	test("refuses a request with no token", async () => {
		let client = await createClient();

		let response = await introspect(client, {});

		expect(response.status).toBe(400);
	});
});

describe("acceptsSignedIntrospection", () => {
	test.each([
		["application/token-introspection+jwt", true],
		["application/json, application/token-introspection+jwt;q=0.5", true],
		["application/token-introspection+jwt;q=0", false],
		["application/json", false],
		[null, false],
	])("reads %s as %s", (accept, signed) => {
		expect(acceptsSignedIntrospection(accept)).toBe(signed);
	});
});
