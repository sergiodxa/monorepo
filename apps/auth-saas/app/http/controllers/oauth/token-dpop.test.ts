/**
 * Drives DPoP (RFC 9449) through the tenant router: proofs at `/oauth/token` bind the
 * access token and a public client's refresh token to the proof's key, and `/userinfo`
 * accepts a bound token only beside a proof signed with that key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { DPoP } from "@sdxc/auth/dpop";
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
import { AccessToken } from "~/app/models/tenant/tokens";
import routes from "~/routes/tenant";

import { userinfoGet } from "../userinfo";

import token from "./token";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";
const REDIRECT_URI = "https://example.com/callback";

/** Where the tenant publishes its token endpoint, which a proof's `htu` names. */
const TOKEN_ENDPOINT = `${ISSUER}/oauth/token`;

/** Where the tenant publishes `/userinfo`. */
const USERINFO = `${ISSUER}/userinfo`;

let tenantDO: Tenant;
let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
	db = new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
});

/** A tenant router serving the token endpoint and `/userinfo`. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.token, token);
	router.map(routes.userinfoGet, userinfoGet);
	return router;
}

/** The headers every request resolved to the fixture tenant carries. */
function tenantHeaders(headers: Record<string, string>): Headers {
	let resolved = new Headers(headers);
	resolved.set(TENANT_ID_HEADER, TENANT_ID);
	resolved.set(TENANT_REGION_HEADER, "wnam");
	resolved.set(TENANT_ISSUER_HEADER, ISSUER);
	return resolved;
}

/**
 * A `POST /oauth/token` request, with a proof for the published token endpoint when a
 * key is given.
 */
async function tokenRequest(
	form: Record<string, string>,
	options: { key?: DPoP; headers?: Record<string, string>; proof?: string } = {},
): Promise<Request> {
	let headers = tenantHeaders(options.headers ?? {});
	headers.set("Content-Type", "application/x-www-form-urlencoded");
	let proof = options.proof ?? (await options.key?.proof("POST", TOKEN_ENDPOINT));
	if (proof !== undefined) headers.set("DPoP", proof);

	return new Request(`https://${TENANT_ID}.example.com/oauth/token`, {
		method: "POST",
		headers,
		body: new URLSearchParams(form).toString(),
	});
}

/** Registers a client of the given kind, answering its id and secret. */
async function createClient(kind: "public" | "confidential") {
	let result = await tenantDO.registerClient({
		name: "Test Client",
		kind,
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		scopes: ["openid", "offline_access"],
		tokenEndpointAuthMethod: kind === "public" ? "none" : "client_secret_basic",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable");
	return { clientId: result.client.id, secret: result.secret };
}

/** A subject, an open session and a code minted for the client, with its verifier. */
async function createCode(clientId: string) {
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

	return { code, codeVerifier };
}

/** The code grant's form for a public client. */
function codeForm(clientId: string, code: { code: string; codeVerifier: string }) {
	return {
		grant_type: "authorization_code",
		client_id: clientId,
		code: code.code,
		code_verifier: code.codeVerifier,
		redirect_uri: REDIRECT_URI,
	};
}

/** The token set a successful grant answers with. */
interface TokenSet {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	error?: string;
}

describe("token endpoint", () => {
	test("binds a public client's tokens to the proof's key", async () => {
		let key = await DPoP.generate();
		let { clientId } = await createClient("public");
		let code = await createCode(clientId);

		let response = await buildRouter().fetch(await tokenRequest(codeForm(clientId, code), { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as TokenSet;
		expect(body.token_type).toBe("DPoP");
		expect(AccessToken.decode(body.access_token).jkt).toBe(await key.thumbprint());
	});

	test("rotates a bound refresh token only beside a proof from the same key", async () => {
		let key = await DPoP.generate();
		let { clientId } = await createClient("public");
		let code = await createCode(clientId);
		let router = buildRouter();

		let issued = (await (
			await router.fetch(await tokenRequest(codeForm(clientId, code), { key }))
		).json()) as TokenSet;
		let refresh = {
			grant_type: "refresh_token",
			client_id: clientId,
			refresh_token: issued.refresh_token ?? "",
		};

		let unproven = await router.fetch(await tokenRequest(refresh));
		expect(unproven.status).toBe(400);
		expect(((await unproven.json()) as TokenSet).error).toBe("invalid_grant");

		let otherKey = await router.fetch(await tokenRequest(refresh, { key: await DPoP.generate() }));
		expect(otherKey.status).toBe(400);

		let proven = await router.fetch(await tokenRequest(refresh, { key }));
		expect(proven.status).toBe(200);
		expect(((await proven.json()) as TokenSet).token_type).toBe("DPoP");
	});

	test("leaves a confidential client's refresh token unbound", async () => {
		let key = await DPoP.generate();
		let { clientId, secret } = await createClient("confidential");
		let code = await createCode(clientId);
		let basic = { Authorization: `Basic ${Base64.encode(`${clientId}:${secret ?? ""}`)}` };
		let router = buildRouter();

		let { client_id: _clientId, ...form } = codeForm(clientId, code);
		let issued = (await (
			await router.fetch(await tokenRequest(form, { key, headers: basic }))
		).json()) as TokenSet;
		expect(issued.token_type).toBe("DPoP");

		let refreshed = await router.fetch(
			await tokenRequest(
				{ grant_type: "refresh_token", refresh_token: issued.refresh_token ?? "" },
				{ headers: basic },
			),
		);
		expect(refreshed.status).toBe(200);
		expect(((await refreshed.json()) as TokenSet).token_type).toBe("Bearer");
	});

	test("refuses a proof made for another URI with invalid_dpop_proof", async () => {
		let key = await DPoP.generate();
		let { clientId } = await createClient("public");
		let code = await createCode(clientId);
		let proof = await key.proof("POST", "https://elsewhere.example.com/oauth/token");

		let response = await buildRouter().fetch(
			await tokenRequest(codeForm(clientId, code), { proof }),
		);

		expect(response.status).toBe(400);
		expect(((await response.json()) as TokenSet).error).toBe("invalid_dpop_proof");
	});

	test("refuses a proof presented twice", async () => {
		let key = await DPoP.generate();
		let { clientId } = await createClient("public");
		let proof = await key.proof("POST", TOKEN_ENDPOINT);
		let router = buildRouter();

		let first = await router.fetch(
			await tokenRequest(codeForm(clientId, await createCode(clientId)), { proof }),
		);
		let second = await router.fetch(
			await tokenRequest(codeForm(clientId, await createCode(clientId)), { proof }),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(400);
		expect(((await second.json()) as TokenSet).error).toBe("invalid_dpop_proof");
	});
});

describe("userinfo", () => {
	/** A bound access token issued to a public client for `key`. */
	async function boundToken(key: DPoP): Promise<string> {
		let { clientId } = await createClient("public");
		let code = await createCode(clientId);
		let response = await buildRouter().fetch(await tokenRequest(codeForm(clientId, code), { key }));
		return ((await response.json()) as TokenSet).access_token;
	}

	test("answers a bound token beside a proof from its key", async () => {
		let key = await DPoP.generate();
		let accessToken = await boundToken(key);

		let response = await buildRouter().fetch(
			new Request(`https://${TENANT_ID}.example.com/userinfo`, {
				headers: tenantHeaders({
					Authorization: `DPoP ${accessToken}`,
					DPoP: await key.proof("GET", USERINFO, { accessToken }),
				}),
			}),
		);

		expect(response.status).toBe(200);
	});

	test("refuses a bound token beside a proof from another key", async () => {
		let accessToken = await boundToken(await DPoP.generate());
		let other = await DPoP.generate();

		let response = await buildRouter().fetch(
			new Request(`https://${TENANT_ID}.example.com/userinfo`, {
				headers: tenantHeaders({
					Authorization: `DPoP ${accessToken}`,
					DPoP: await other.proof("GET", USERINFO, { accessToken }),
				}),
			}),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain('DPoP error="invalid_token"');
	});

	test("refuses a bound token presented as a bearer token", async () => {
		let accessToken = await boundToken(await DPoP.generate());

		let response = await buildRouter().fetch(
			new Request(`https://${TENANT_ID}.example.com/userinfo`, {
				headers: tenantHeaders({ Authorization: `Bearer ${accessToken}` }),
			}),
		);

		expect(response.status).toBe(401);
	});

	test("names both schemes to a request with no token", async () => {
		let response = await buildRouter().fetch(
			new Request(`https://${TENANT_ID}.example.com/userinfo`, { headers: tenantHeaders({}) }),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toMatch(/^Bearer .*, DPoP algs="/);
	});
});
