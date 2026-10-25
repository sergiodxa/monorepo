/**
 * Drives the RFC 8693 token exchange grant through the tenant router: a user's access
 * token, minted by a real code exchange, is traded for a narrower one aimed at an
 * audience the exchanging client's policy lists, and every refusal the grant defines.
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
import { ACCESS_TOKEN_TYPE, TOKEN_EXCHANGE_GRANT_TYPE } from "~/app/models/tenant/token-exchange";
import { AccessToken } from "~/app/models/tenant/tokens";
import routes from "~/routes/tenant";

import token from "./token";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";
const REDIRECT_URI = "https://example.com/callback";

/** The downstream API the exchanging client may target. */
const REPORTS_API = "https://reports.example.com";

let tenantDO: Tenant;
let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
	db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
});

/** A tenant router serving the token endpoint. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.token, token);
	return router;
}

/** A `POST /oauth/token` request resolved to the fixture tenant. */
function tokenRequest(form: [string, string][], authorization?: string): Request {
	let headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
	headers.set(TENANT_ID_HEADER, TENANT_ID);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, ISSUER);
	if (authorization) headers.set("Authorization", authorization);

	return new Request(`https://${TENANT_ID}.example.com/oauth/token`, {
		method: "POST",
		headers,
		body: new URLSearchParams(form).toString(),
	});
}

/** Registers a client, answering its id and its `Basic` credentials. */
async function createClient(
	options: { kind?: "public" | "confidential"; tokenExchangeAudiences?: string[] } = {},
) {
	let kind = options.kind ?? "confidential";
	let result = await tenantDO.registerClient({
		name: "Test Client",
		kind,
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		scopes: ["openid", "reports:read", "reports:write"],
		tokenEndpointAuthMethod: kind === "public" ? "none" : "client_secret_basic",
		requireConsent: false,
		tokenExchangeAudiences: options.tokenExchangeAudiences,
	});
	if (!result.ok) throw new Error("unreachable");
	return {
		clientId: result.client.id,
		basic: `Basic ${Base64.encode(`${result.client.id}:${result.secret ?? ""}`)}`,
	};
}

/** A user's access token, minted by a real code exchange through the router. */
async function userAccessToken(scopes = ["openid", "reports:read", "reports:write"]) {
	let { clientId, basic } = await createClient();
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
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		code_challenge: Base64Url.encode(verifierHashed.data),
		scopes,
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
		tokenRequest(
			[
				["grant_type", "authorization_code"],
				["code", code],
				["code_verifier", codeVerifier],
				["redirect_uri", REDIRECT_URI],
			],
			basic,
		),
	);
	let body = (await response.json()) as { access_token: string };
	return { subjectId: created.subjectId, clientId, accessToken: body.access_token };
}

/** The answer an exchange produces, success or refusal. */
interface ExchangeAnswer {
	access_token?: string;
	issued_token_type?: string;
	token_type?: string;
	scope?: string;
	error?: string;
}

/**
 * Posts a token exchange.
 *
 * @param authorization - The exchanging client's credentials.
 * @param extra - Parameters beyond the grant type.
 */
async function exchange(
	authorization: string,
	extra: [string, string][],
): Promise<{ status: number; body: ExchangeAnswer }> {
	let response = await buildRouter().fetch(
		tokenRequest([["grant_type", TOKEN_EXCHANGE_GRANT_TYPE], ...extra], authorization),
	);
	return { status: response.status, body: (await response.json()) as ExchangeAnswer };
}

describe("token exchange", () => {
	test("trades a user's token for a narrower one aimed at a listed audience", async () => {
		let user = await userAccessToken();
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { status, body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
			["audience", REPORTS_API],
			["scope", "reports:read"],
		]);

		expect(status).toBe(200);
		expect(body.issued_token_type).toBe(ACCESS_TOKEN_TYPE);
		expect(body.token_type).toBe("Bearer");
		expect(body.scope).toBe("reports:read");

		let exchanged = AccessToken.decode(body.access_token ?? "");
		let original = AccessToken.decode(user.accessToken);
		expect(exchanged.subject).toBe(user.subjectId);
		expect(exchanged.audience).toBe(REPORTS_API);
		expect(exchanged.clientId).toBe(gateway.clientId);
		expect(exchanged.expirationTime).toBeLessThanOrEqual(original.expirationTime ?? 0);
	});

	test("defaults to the client's one audience and the subject token's scopes", async () => {
		let user = await userAccessToken();
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
		]);

		let exchanged = AccessToken.decode(body.access_token ?? "");
		expect(exchanged.audience).toBe(REPORTS_API);
		expect(exchanged.scope).toBe("openid reports:read reports:write");
	});

	test("names the actor token's subject and client in act", async () => {
		let user = await userAccessToken();
		let agent = await userAccessToken();
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
			["actor_token", agent.accessToken],
			["actor_token_type", ACCESS_TOKEN_TYPE],
		]);

		expect(AccessToken.decode(body.access_token ?? "").payload.act).toEqual({
			sub: agent.subjectId,
			client_id: agent.clientId,
		});
	});

	test("refuses a client with no exchange policy", async () => {
		let user = await userAccessToken();
		let other = await createClient();

		let { status, body } = await exchange(other.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
		]);

		expect(status).toBe(400);
		expect(body.error).toBe("unauthorized_client");
	});

	test("refuses an audience the policy does not list", async () => {
		let user = await userAccessToken();
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
			["resource", "https://billing.example.com"],
		]);

		expect(body.error).toBe("invalid_target");
	});

	test("refuses a scope the subject token does not carry", async () => {
		let user = await userAccessToken(["openid", "reports:read"]);
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", ACCESS_TOKEN_TYPE],
			["scope", "reports:write"],
		]);

		expect(body.error).toBe("invalid_scope");
	});

	test("refuses a subject token this tenant did not issue", async () => {
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", "not-a-token"],
			["subject_token_type", ACCESS_TOKEN_TYPE],
		]);

		expect(body.error).toBe("invalid_grant");
	});

	test("refuses a subject token type other than an access token", async () => {
		let user = await userAccessToken();
		let gateway = await createClient({ tokenExchangeAudiences: [REPORTS_API] });

		let { body } = await exchange(gateway.basic, [
			["subject_token", user.accessToken],
			["subject_token_type", "urn:ietf:params:oauth:token-type:id_token"],
		]);

		expect(body.error).toBe("invalid_request");
	});

	test("refuses a client that does not authenticate", async () => {
		let user = await userAccessToken();
		let publicClient = await createClient({ kind: "public" });

		let response = await buildRouter().fetch(
			tokenRequest([
				["grant_type", TOKEN_EXCHANGE_GRANT_TYPE],
				["client_id", publicClient.clientId],
				["subject_token", user.accessToken],
				["subject_token_type", ACCESS_TOKEN_TYPE],
			]),
		);

		expect(response.status).toBe(401);
	});
});
