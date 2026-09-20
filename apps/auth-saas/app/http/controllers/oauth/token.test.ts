/**
 * Drives `/oauth/token` through the tenant router, building a real authorization
 * code the way `tokens.test.ts` does, so the test exercises the HTTP-layer
 * client-credential detection and form parsing, not just `exchangeCode` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64, Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import { authorizationCodes } from "~/database/authorization";
import { openSession } from "~/database/sessions";
import Tenant from "~/database/tenant-do";
import routes from "~/routes/tenant";

import token from "./token";

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

/** Builds a tenant router wired to the constructed Durable Object. */
function buildRouter() {
	let router = createRouter({
		middleware: [tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>)],
	});
	router.map(routes.token, token);
	return router;
}

/** A `POST /oauth/token` request already resolved to the fixture tenant. */
function tokenRequest(form: Record<string, string>, headers: Record<string, string> = {}): Request {
	let body = new URLSearchParams(form);
	let requestHeaders = new Headers(headers);
	requestHeaders.set(TENANT_ID_HEADER, TENANT_ID);
	requestHeaders.set(TENANT_REGION_HEADER, "wnam");
	requestHeaders.set(TENANT_ISSUER_HEADER, ISSUER);
	requestHeaders.set("Content-Type", "application/x-www-form-urlencoded");

	return new Request(`https://${TENANT_ID}.example.com/oauth/token`, {
		method: "POST",
		headers: requestHeaders,
		body: body.toString(),
	});
}

/** Digests text with SHA-256, throwing rather than returning a `Result`, for test setup. */
async function digestHex(text: string): Promise<string> {
	let hashed = await sha256(text);
	if (isFailure(hashed)) throw new Error("unreachable");
	return Hex.encode(hashed.data);
}

/** Registers a confidential test client, throwing if the record was refused. */
async function createTestClient() {
	let result = await tenantDO.registerClient({
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		scopes: ["openid", "profile", "offline_access"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

interface TestCodeInput {
	clientId: string;
	subjectId: string;
	sessionId: string;
	scopes?: string[];
}

/** Writes an authorization code row directly, the way `tokens.test.ts` builds one. */
async function createTestCode(
	input: TestCodeInput,
): Promise<{ code: string; codeVerifier: string }> {
	let code = `code-${generateUUID()}`;
	let codeVerifier = `verifier-${generateUUID()}`;
	let verifierHashed = await sha256(codeVerifier);
	if (isFailure(verifierHashed)) throw new Error("unreachable");

	let now = Date.now();

	await db.create(authorizationCodes, {
		id: generateUUID(),
		code_hash: await digestHex(code),
		client_id: input.clientId,
		redirect_uri: REDIRECT_URI,
		code_challenge: Base64Url.encode(verifierHashed.data),
		scopes: input.scopes ?? ["openid"],
		subject_id: input.subjectId,
		session_id: input.sessionId,
		nonce: null,
		auth_time: now,
		created_at: now,
		expires_at: now + 60_000,
		redeemed_at: null,
		token_family_id: null,
	});

	return { code, codeVerifier };
}

/** A subject and its open session, ready to bind an authorization code to. */
async function createTestSubjectAndSession() {
	let created = await tenantDO.createSubject({
		identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
	});
	if (!created.ok) throw new Error("unreachable");

	let session = await openSession(db, {
		subjectId: created.subjectId,
		amr: ["pwd"],
		remembered: true,
	});
	return { subjectId: created.subjectId, sessionId: session.sessionId };
}

describe("authorization_code grant", () => {
	test("exchanges a code for a token set, authenticating with Basic", async () => {
		let { client, secret } = await createTestClient();
		let { subjectId, sessionId } = await createTestSubjectAndSession();
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId,
			scopes: ["openid", "offline_access"],
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{
					grant_type: "authorization_code",
					code,
					code_verifier: codeVerifier,
					redirect_uri: REDIRECT_URI,
				},
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.id_token).toEqual(expect.any(String));
		expect(body.refresh_token).toEqual(expect.any(String));
		expect(body.token_type).toBe("Bearer");
		expect(body.scope).toBe("openid offline_access");
	});

	test("a client_id presented both in Basic and the form body is invalid_request", async () => {
		let { client, secret } = await createTestClient();
		let { subjectId, sessionId } = await createTestSubjectAndSession();
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId,
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{
					grant_type: "authorization_code",
					code,
					code_verifier: codeVerifier,
					redirect_uri: REDIRECT_URI,
					client_id: client.id,
				},
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_request");
	});

	test("a wrong client secret is invalid_client at 401 with a Basic challenge", async () => {
		let { client } = await createTestClient();
		let { subjectId, sessionId } = await createTestSubjectAndSession();
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId,
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{
					grant_type: "authorization_code",
					code,
					code_verifier: codeVerifier,
					redirect_uri: REDIRECT_URI,
				},
				{ Authorization: `Basic ${Base64.encode(`${client.id}:wrong-secret`)}` },
			),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe("Basic");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});

	test("an unsupported grant_type is 400", async () => {
		let response = await buildRouter().fetch(tokenRequest({ grant_type: "client_credentials" }));

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("unsupported_grant_type");
	});
});

describe("refresh_token grant", () => {
	test("rotates a refresh token into a fresh token set", async () => {
		let { client, secret } = await createTestClient();
		let { subjectId, sessionId } = await createTestSubjectAndSession();
		let { code, codeVerifier } = await createTestCode({
			clientId: client.id,
			subjectId,
			sessionId,
			scopes: ["openid", "offline_access"],
		});

		let minted = await tenantDO.exchangeCode({
			code,
			codeVerifier,
			redirectUri: REDIRECT_URI,
			clientId: client.id,
			clientSecret: secret,
			authScheme: "basic",
			now: Date.now(),
		});
		if (minted.kind !== "tokens" || !minted.refreshToken) throw new Error("unreachable");

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: "refresh_token", refresh_token: minted.refreshToken },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.refresh_token).not.toBe(minted.refreshToken);
	});
});
