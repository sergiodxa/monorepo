/**
 * Drives `/oauth/token` through the tenant router, building a real authorization
 * code the way `tokens.test.ts` does, so the test exercises the HTTP-layer
 * client-credential detection and form parsing, not just `exchangeCode` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64, Base64Url, Hex, randomToken, sha256 } from "@sdxc/crypto";
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
import { authorizationCodes } from "~/database/authorization";
import { DEVICE_CODE_GRANT_TYPE, deviceAuthorizations } from "~/database/device-authorization";
import { openSession } from "~/database/sessions";
import { signingKeys } from "~/database/signing-keys";
import Tenant from "~/database/tenant-do";
import { IdToken } from "~/database/tokens";
import routes from "~/routes/tenant";

import jwks from "../well-known/jwks";
import openidConfiguration from "../well-known/openid-configuration";

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

/** Builds a tenant router wired to the constructed Durable Object, with the same
 * form-data middleware the real tenant router runs every request through — the
 * token endpoint reads `ctx.formData`, populated there, rather than the request
 * body directly. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.token, token);
	router.map(routes.openidConfiguration, openidConfiguration);
	router.map(routes.jwks, jwks);
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
async function createTestClient(idTokenSignedResponseAlg?: "ES256" | "RS256") {
	let result = await tenantDO.registerClient({
		idTokenSignedResponseAlg,
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
		let response = await buildRouter().fetch(tokenRequest({ grant_type: "password" }));

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("unsupported_grant_type");
	});
});

/** A `GET` for one of the tenant's discovery documents, already resolved to the fixture tenant. */
function discoveryRequest(path: string): Request {
	return new Request(`https://${TENANT_ID}.example.com${path}`, {
		headers: {
			[TENANT_ID_HEADER]: TENANT_ID,
			[TENANT_REGION_HEADER]: "wnam",
			[TENANT_ISSUER_HEADER]: ISSUER,
		},
	});
}

/** Exchanges a fresh code for the given client and answers the ID token it minted. */
async function exchangeForIdToken(client: { id: string }, secret: string | null): Promise<string> {
	let { subjectId, sessionId } = await createTestSubjectAndSession();
	let { code, codeVerifier } = await createTestCode({ clientId: client.id, subjectId, sessionId });

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

	let body = (await response.json()) as { id_token: string };
	return body.id_token;
}

/** The `alg` and `kid` a compact JWS names in its protected header. */
function protectedHeader(jws: string): { alg: string; kid: string } {
	let [encoded = ""] = jws.split(".");
	let decoded = Base64Url.decode(encoded);
	if (isFailure(decoded)) throw decoded.error;
	return JSON.parse(new TextDecoder().decode(decoded.data)) as { alg: string; kid: string };
}

describe("ID token signing algorithm", () => {
	test("discovery lists RS256 beside ES256", async () => {
		let response = await buildRouter().fetch(discoveryRequest("/.well-known/openid-configuration"));
		let body = (await response.json()) as { id_token_signing_alg_values_supported: string[] };

		expect(body.id_token_signing_alg_values_supported).toEqual(["ES256", "RS256"]);
	});

	test("an RS256 client gets an RS256-signed ID token that verifies against the JWKS", async () => {
		let { client, secret } = await createTestClient("RS256");
		let idToken = await exchangeForIdToken(client, secret);

		let response = await buildRouter().fetch(discoveryRequest("/.well-known/jwks.json"));
		let keys = await JWK.importLocal((await response.json()) as { keys: [] });
		let verified = await IdToken.verify(idToken, keys, {
			issuer: ISSUER,
			audience: client.id,
			algorithms: [JWK.Algorithm.RS256],
		});

		expect(protectedHeader(idToken).alg).toBe("RS256");
		expect(verified.audience).toBe(client.id);
	});

	test("a client registered without an algorithm keeps ES256 ID tokens", async () => {
		let { client, secret } = await createTestClient();
		let idToken = await exchangeForIdToken(client, secret);

		expect(protectedHeader(idToken).alg).toBe("ES256");
	});

	test("a tenant provisioned before RS256 keys existed generates one on first use and publishes it", async () => {
		await db.deleteMany(signingKeys, { where: { alg: "RS256" } });
		let { client, secret } = await createTestClient("RS256");

		let idToken = await exchangeForIdToken(client, secret);

		let response = await buildRouter().fetch(discoveryRequest("/.well-known/jwks.json"));
		let published = (await response.json()) as { keys: Array<{ kid: string; alg: string }> };
		expect(published.keys).toContainEqual(
			expect.objectContaining({ kid: protectedHeader(idToken).kid, alg: "RS256" }),
		);
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

/** Registers a confidential client carrying `client_credentials`, granting the tenant's own machine_access feature first. */
async function createMachineClient(scopes: string[] = ["reports.read"]) {
	await tenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	let result = await tenantDO.registerClient({
		name: "Machine Client",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: ["client_credentials"],
		responseTypes: [],
		scopes,
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

describe("client_credentials grant", () => {
	test("exchanges a client's own credentials for a token with no subject", async () => {
		let { client, secret } = await createMachineClient(["reports.read"]);

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: "client_credentials", scope: "reports.read" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.id_token).toBeUndefined();
		expect(body.refresh_token).toBeUndefined();
		expect(body.token_type).toBe("Bearer");
		expect(body.scope).toBe("reports.read");
	});

	test("a scope outside the client's own ceiling is invalid_scope", async () => {
		let { client, secret } = await createMachineClient(["reports.read"]);

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: "client_credentials", scope: "reports.write" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_scope");
	});

	test("a client that never registered the grant is refused", async () => {
		let { client, secret } = await createTestClient();

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: "client_credentials" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("unauthorized_client");
	});

	test("no credentials at all is invalid_client, since this grant belongs to a confidential client alone", async () => {
		let { client } = await createMachineClient();

		let response = await buildRouter().fetch(
			tokenRequest({ grant_type: "client_credentials", client_id: client.id }),
		);

		expect(response.status).toBe(401);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});
});

/** Registers a confidential client carrying the device grant, granting the tenant's own device_grant feature first. */
async function createDeviceGrantClient(scopes: string[] = ["openid", "offline_access"]) {
	await tenantDO.applyEntitlements({
		plan: "pro",
		features: { device_grant: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	let result = await tenantDO.registerClient({
		name: "Living Room TV",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: [DEVICE_CODE_GRANT_TYPE],
		responseTypes: [],
		scopes,
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok || !result.secret) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

interface TestDeviceAuthorizationRowInput {
	deviceCode: string;
	clientId: string;
	scopes: string[];
	now: number;
	approved?: { subjectId: string; sessionId: string };
	deniedAt?: number | null;
	expiresAt?: number;
}

/** Writes a `device_authorizations` row directly against the tenant's own database, the way `decideDeviceApproval` will once it exists. */
async function createTestDeviceAuthorizationRow(input: TestDeviceAuthorizationRowInput) {
	await db.create(deviceAuthorizations, {
		id: `devr_${generateUUID()}`,
		device_code_hash: await digestHex(input.deviceCode),
		user_code: "BCDFGHJK",
		client_id: input.clientId,
		scopes: input.scopes,
		interval_s: 5,
		last_polled_at: null,
		expires_at: input.expiresAt ?? input.now + 600_000,
		approved_at: input.approved ? input.now : null,
		denied_at: input.deniedAt ?? null,
		redeemed_at: null,
		subject_id: input.approved?.subjectId ?? null,
		session_id: input.approved?.sessionId ?? null,
		auth_time: input.approved ? input.now : null,
		amr: input.approved ? ["pwd"] : null,
		token_family_id: null,
		created_at: input.now,
	});
}

describe("device_code grant", () => {
	test("redeems an approved device code for real tokens through the HTTP endpoint", async () => {
		let { client, secret } = await createDeviceGrantClient(["openid", "offline_access"]);
		let { subjectId, sessionId } = await createTestSubjectAndSession();
		let deviceCode = randomToken({ bytes: 32 });
		let now = Date.now();

		await createTestDeviceAuthorizationRow({
			deviceCode,
			clientId: client.id,
			scopes: ["openid", "offline_access"],
			now,
			approved: { subjectId, sessionId },
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.refresh_token).toEqual(expect.any(String));
		expect(body.token_type).toBe("Bearer");
	});

	test("answers authorization_pending before any decision", async () => {
		let { client, secret } = await createDeviceGrantClient();
		let deviceCode = randomToken({ bytes: 32 });
		let now = Date.now();

		await createTestDeviceAuthorizationRow({
			deviceCode,
			clientId: client.id,
			scopes: ["openid"],
			now,
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("authorization_pending");
	});

	test("answers slow_down on a too-soon second poll", async () => {
		let { client, secret } = await createDeviceGrantClient();
		let deviceCode = randomToken({ bytes: 32 });
		let now = Date.now();

		await createTestDeviceAuthorizationRow({
			deviceCode,
			clientId: client.id,
			scopes: ["openid"],
			now,
		});

		let auth = { Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` };

		let first = await buildRouter().fetch(
			tokenRequest({ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode }, auth),
		);
		expect(((await first.json()) as Record<string, unknown>).error).toBe("authorization_pending");

		let second = await buildRouter().fetch(
			tokenRequest({ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode }, auth),
		);
		expect(second.status).toBe(400);
		let body = (await second.json()) as Record<string, unknown>;
		expect(body.error).toBe("slow_down");
	});

	test("answers access_denied for a denied row", async () => {
		let { client, secret } = await createDeviceGrantClient();
		let deviceCode = randomToken({ bytes: 32 });
		let now = Date.now();

		await createTestDeviceAuthorizationRow({
			deviceCode,
			clientId: client.id,
			scopes: ["openid"],
			now,
			deniedAt: now,
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("access_denied");
	});

	test("answers expired_token for a row past its expiry", async () => {
		let { client, secret } = await createDeviceGrantClient();
		let deviceCode = randomToken({ bytes: 32 });
		let now = Date.now();

		await createTestDeviceAuthorizationRow({
			deviceCode,
			clientId: client.id,
			scopes: ["openid"],
			now: now - 700_000,
			expiresAt: now - 1000,
		});

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("expired_token");
	});

	test("answers invalid_grant for a device code that does not resolve", async () => {
		let { client, secret } = await createDeviceGrantClient();

		let response = await buildRouter().fetch(
			tokenRequest(
				{ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: "not-a-real-device-code" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_grant");
	});
});
