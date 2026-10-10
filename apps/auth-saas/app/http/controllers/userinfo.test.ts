/**
 * Drives `/userinfo` through the tenant router, minting a real access token from a
 * real authorization code the way `tokens.test.ts` builds one, so the test
 * exercises the actual bearer-verification path rather than the DO methods alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse as parseChallenge } from "@sdxc/auth/bearer-challenge";
import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { wellKnown } from "@sdxc/well-known/middleware";
import { parse as parseProtectedResource } from "@sdxc/well-known/oauth-protected-resource";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import { userinfoMetadataEntry } from "~/app/lib/userinfo-resource";
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

/** Where every challenge points, the tenant's userinfo metadata (RFC 9728 §3.1). */
const METADATA_URL = new URL(`${ISSUER}/.well-known/oauth-protected-resource/userinfo`);

/** The one `Bearer` challenge a refusal's `WWW-Authenticate` carries. */
function challengeOf(response: Response) {
	let parsed = parseChallenge(response.headers.get("WWW-Authenticate") ?? "");
	if (isFailure(parsed)) throw parsed.error;
	let [challenge] = parsed.data;
	if (!challenge) throw new Error("the response carried no Bearer challenge");
	return challenge;
}

/** A request already resolved to the fixture tenant. */
function tenantRequest(path: string): Request {
	return new Request(`https://${TENANT_ID}.example.com${path}`, {
		headers: {
			[TENANT_ID_HEADER]: TENANT_ID,
			[TENANT_REGION_HEADER]: "wnam",
			[TENANT_ISSUER_HEADER]: ISSUER,
		},
	});
}

/** Builds a tenant router wired to the constructed Durable Object, serving the userinfo metadata too. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			wellKnown({ "oauth-protected-resource": userinfoMetadataEntry }),
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
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

	test("a missing Authorization header is 401 with a challenge naming no error", async () => {
		let response = await buildRouter().fetch(userinfoRequest());

		expect(response.status).toBe(401);
		expect(challengeOf(response)).toMatchObject({ error: null, resourceMetadata: METADATA_URL });
	});

	test("the challenge's resource_metadata leads to metadata naming /userinfo and the issuer", async () => {
		let refused = await buildRouter().fetch(userinfoRequest());
		let pointer = challengeOf(refused).resourceMetadata;
		if (!pointer) throw new Error("the challenge carried no resource_metadata");

		let response = await buildRouter().fetch(tenantRequest(pointer.pathname));
		expect(response.status).toBe(200);

		let metadata = parseProtectedResource(await response.text(), {
			resource: `${ISSUER}/userinfo`,
		});
		if (isFailure(metadata)) throw metadata.error;
		expect(metadata.data.resource.href).toBe(`${ISSUER}/userinfo`);
		expect(metadata.data.authorizationServers.map((server) => server.origin)).toEqual([ISSUER]);
	});

	test("a malformed bearer token is 401 with an invalid_token challenge", async () => {
		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: "Bearer not-a-real-jwt" } }),
		);

		expect(response.status).toBe(401);
		expect(challengeOf(response)).toMatchObject({
			error: "invalid_token",
			resourceMetadata: METADATA_URL,
		});
	});

	test("a token whose grant does not cover openid is 403 with insufficient_scope", async () => {
		let accessToken = await mintAccessToken(["profile"]);

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(403);
		expect(challengeOf(response)).toMatchObject({
			error: "insufficient_scope",
			scope: ["openid"],
			resourceMetadata: METADATA_URL,
		});
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("insufficient_scope");
	});

	test("a token naming a subject that no longer resolves is 401, not distinguished from invalid", async () => {
		let accessToken = await mintAccessToken(["openid"], "sub_does_not_exist");

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(401);
		expect(challengeOf(response)).toMatchObject({ error: "invalid_token" });
	});

	test("Cache-Control states the access token's own remaining lifetime", async () => {
		let accessToken = await mintAccessToken(["openid"]);

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(200);
		let cacheControl = response.headers.get("Cache-Control");
		expect(cacheControl).toMatch(/^private, max-age=\d+$/);

		let maxAge = Number(cacheControl?.match(/max-age=(\d+)/)?.[1]);
		expect(maxAge).toBeGreaterThan(0);
		expect(maxAge).toBeLessThanOrEqual(60 * 60);
	});

	test("includes a roles claim resolved from the subject's tenant-scope role", async () => {
		let created = await tenantDO.createSubject({
			identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
			profile: { name: "Jane Doe" },
		});
		if (!created.ok) throw new Error("unreachable");

		let assigned = await tenantDO.assignRole({
			subjectId: created.subjectId,
			scope: "tenant",
			roleKey: "admin",
			actor: { type: "subject", id: created.subjectId },
		});
		expect(assigned.ok).toBe(true);

		let accessToken = await mintAccessToken(["openid"], created.subjectId);

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${accessToken}` } }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.roles).toEqual(["admin"]);
		expect(body).not.toHaveProperty("permissions");
	});

	test("includes a permissions claim only for a client whose include_permissions switch is on", async () => {
		let registered = await tenantDO.registerClient({
			name: "Test Client",
			kind: "confidential",
			redirectUris: [REDIRECT_URI],
			postLogoutRedirectUris: [],
			grantTypes: ["authorization_code"],
			responseTypes: ["code"],
			scopes: ["openid"],
			tokenEndpointAuthMethod: "client_secret_basic",
			requireConsent: false,
		});
		if (!registered.ok) throw new Error("unreachable");

		let toggled = await tenantDO.setClientPermissionClaim({
			clientId: registered.client.id,
			include: true,
			actor: { type: "platform", id: "system" },
		});
		expect(toggled.ok).toBe(true);

		let created = await tenantDO.createSubject({
			identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
			profile: { name: "Jane Doe" },
		});
		if (!created.ok) throw new Error("unreachable");

		let session = await openSession(db, {
			subjectId: created.subjectId,
			amr: ["pwd"],
			remembered: true,
		});
		let { code, codeVerifier } = await createTestCode({
			clientId: registered.client.id,
			subjectId: created.subjectId,
			sessionId: session.sessionId,
			scopes: ["openid"],
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

		let response = await buildRouter().fetch(
			userinfoRequest({ headers: { Authorization: `Bearer ${outcome.accessToken}` } }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.permissions).toEqual([]);
	});
});
