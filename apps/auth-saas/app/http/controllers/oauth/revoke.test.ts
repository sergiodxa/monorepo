/**
 * Drives `/oauth/revoke` through the tenant router against tokens minted by a real code
 * exchange: a revoked refresh token stops rotating, and the endpoint confirms nothing
 * about tokens the caller does not hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64, Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
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
import Tenant from "~/app/models/tenant/object";
import { openSession } from "~/app/models/tenant/sessions";
import routes from "~/routes/tenant";

import revoke from "./revoke";
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

/** A tenant router serving the token and revocation endpoints. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.token, token);
	router.map(routes.revoke, revoke);
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

/** Rotates a refresh token as `client`, answering the response status. */
async function refresh(client: { basic: string }, refreshToken: string): Promise<number> {
	let response = await buildRouter().fetch(
		post(
			"/oauth/token",
			{ grant_type: "refresh_token", refresh_token: refreshToken },
			{ Authorization: client.basic },
		),
	);
	return response.status;
}

/** Revokes a token as `client`. */
async function revokeAs(client: { basic: string }, form: Record<string, string>) {
	return await buildRouter().fetch(post("/oauth/revoke", form, { Authorization: client.basic }));
}

describe("POST /oauth/revoke", () => {
	test("ends a refresh token the caller holds", async () => {
		let client = await createClient();
		let tokens = await issueTokens(client);

		let response = await revokeAs(client, {
			token: tokens.refresh_token,
			token_type_hint: "refresh_token",
		});

		expect(response.status).toBe(200);
		expect(await refresh(client, tokens.refresh_token)).toBe(400);
	});

	test("leaves another client's refresh token working and says nothing about it", async () => {
		let owner = await createClient();
		let other = await createClient();
		let tokens = await issueTokens(owner);

		let response = await revokeAs(other, { token: tokens.refresh_token });

		expect(response.status).toBe(200);
		expect(await refresh(owner, tokens.refresh_token)).toBe(200);
	});

	test("answers an unknown token as revoked", async () => {
		let client = await createClient();

		expect((await revokeAs(client, { token: "never-issued" })).status).toBe(200);
	});

	test("refuses a live access token with unsupported_token_type", async () => {
		let client = await createClient();
		let tokens = await issueTokens(client);

		let response = await revokeAs(client, { token: tokens.access_token });

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toBe("unsupported_token_type");
	});

	test("refuses a caller whose credentials do not verify", async () => {
		let client = await createClient();

		let response = await buildRouter().fetch(
			post(
				"/oauth/revoke",
				{ token: "x" },
				{ Authorization: `Basic ${Base64.encode(`${client.clientId}:wrong`)}` },
			),
		);

		expect(response.status).toBe(401);
	});
});
