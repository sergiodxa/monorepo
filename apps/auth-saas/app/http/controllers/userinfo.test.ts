/**
 * Drives `/userinfo` through the tenant router, minting a real access token from a
 * real authorization code the way `tokens.test.ts` builds one, so the test
 * exercises the actual bearer-verification path rather than the DO methods alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, Hex, sha256 } from "@sdxc/crypto";
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

import { userinfoGet, userinfoPost } from "./userinfo";

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
	router.map(routes.userinfoGet, userinfoGet);
	router.map(routes.userinfoPost, userinfoPost);
	return router;
}

/** A `/userinfo` request already resolved to the fixture tenant. */
function userinfoRequest(init?: RequestInit): Request {
	let headers = new Headers(init?.headers);
	headers.set(TENANT_ID_HEADER, TENANT_ID);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, ISSUER);
	return new Request(`https://${TENANT_ID}.example.com/userinfo`, { ...init, headers });
}

/** Digests text with SHA-256, throwing rather than returning a `Result`, for test setup. */
async function digestHex(text: string): Promise<string> {
	let hashed = await sha256(text);
	if (isFailure(hashed)) throw new Error("unreachable");
	return Hex.encode(hashed.data);
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

/** Registers a client and mints a real access token for a fresh subject, at the given scopes. */
async function mintAccessToken(scopes: string[], subjectId?: string): Promise<string> {
	let registered = await tenantDO.registerClient({
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid", "profile", "email"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!registered.ok) throw new Error("unreachable");

	let resolvedSubjectId = subjectId;
	if (!resolvedSubjectId) {
		let created = await tenantDO.createSubject({
			identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
			profile: { name: "Jane Doe" },
		});
		if (!created.ok) throw new Error("unreachable");
		resolvedSubjectId = created.subjectId;
	}

	let session = await openSession(db, {
		subjectId: resolvedSubjectId,
		amr: ["pwd"],
		remembered: true,
	});

	let { code, codeVerifier } = await createTestCode({
		clientId: registered.client.id,
		subjectId: resolvedSubjectId,
		sessionId: session.sessionId,
		scopes,
	});

	let outcome = await tenantDO.exchangeCode({
		code,
		codeVerifier,
		redirectUri: REDIRECT_URI,
		clientId: registered.client.id,
		clientSecret: registered.secret,
		authScheme: "basic",
		now: Date.now(),
	});
	if (outcome.kind !== "tokens") throw new Error("unreachable");

	return outcome.accessToken;
}

describe("GET /userinfo", () => {
	test("returns the subject's claims for a valid bearer token", async () => {
		let accessToken = await mintAccessToken(["openid", "profile", "email"]);

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.sub).toEqual(expect.any(String));
		expect(body.name).toBe("Jane Doe");
	});

	test("also answers a POST the same way", async () => {
		let accessToken = await mintAccessToken(["openid"]);

		let response = await buildRouter().fetch(
			userinfoRequest({ method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(200);
	});

	test("a missing Authorization header is 401 with a bare Bearer challenge", async () => {
		let response = await buildRouter().fetch(userinfoRequest());

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
	});

	test("a malformed bearer token is 401 with an invalid_token challenge", async () => {
		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: "Bearer not-a-real-jwt" } }),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="invalid_token"');
	});

	test("a token whose grant does not cover openid is 403 with insufficient_scope", async () => {
		let accessToken = await mintAccessToken(["profile"]);

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(403);
		expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="insufficient_scope"');
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("insufficient_scope");
	});

	test("a token naming a subject that no longer resolves is 401, not distinguished from invalid", async () => {
		let accessToken = await mintAccessToken(["openid"], "sub_does_not_exist");

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="invalid_token"');
	});
});
