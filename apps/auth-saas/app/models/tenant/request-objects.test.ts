/**
 * Drives `verifyRequestObject` against a real SQLite-backed tenant database, with the
 * request object and RSA key RFC 9126 §3 prints, a fresh ES256 key served from a
 * `jwks_uri` through MSW, and every claim RFC 9101 holds the object to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { JWK, JWT } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { ClientJwks, RegisterClientInput } from "~/app/models/tenant/clients";

import { clients, registerClient } from "~/app/models/tenant/clients";
import { verifyRequestObject } from "~/app/models/tenant/request-objects";
import {
	RFC9126_CLIENT_ID,
	RFC9126_ISSUER,
	RFC9126_PARAMETERS,
	RFC9126_PRIVATE_JWK,
	RFC9126_PUBLIC_JWK,
	RFC9126_REDIRECT_URI,
	RFC9126_REQUEST_OBJECT,
	RFC9126_REQUEST_OBJECT_EXP,
} from "~/app/test/rfc9126";
import { runMigrations } from "~/database/tenant-migrations";

/** A moment the RFC's request object has not yet expired at. */
const BEFORE_RFC_EXP = (RFC9126_REQUEST_OBJECT_EXP - 30) * 1000;

/** Where the `jwks_uri` client serves its key set. */
const JWKS_URI = "https://client.example.com/jwks.json";

/** A request object as RFC 9101 §4 types it, for signing fixtures. */
class TypedRequestObject extends JWT {
	static override type = "oauth-authz-req+jwt";
}

const server = setupServer();

let db: Database;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);
});

/** Registers a public client and renames it, so a fixture can carry the id an RFC example names. */
async function createClient(
	clientId: string,
	overrides: Partial<RegisterClientInput> = {},
): Promise<void> {
	let result = await registerClient(db, {
		name: "Request object client",
		kind: "public",
		redirectUris: [RFC9126_REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["account-information"],
		tokenEndpointAuthMethod: "none",
		requireConsent: false,
		...overrides,
	});
	if (!result.ok) throw new Error(`client refused: ${result.reason}`);
	await db.update(clients, { id: result.client.id }, { id: clientId });
}

/** The RFC 9126 §3 private key, imported for signing. */
async function rfcSigningKey(): Promise<JWK.SigningKey> {
	let key = await crypto.subtle.importKey(
		"jwk",
		RFC9126_PRIVATE_JWK,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	return { id: RFC9126_PRIVATE_JWK.kid, alg: JWK.Algorithm.RS256, private: key };
}

/** The RFC 9126 §3 claims, re-signed with the RFC's own key under the `typ` RFC 9101 §4 asks for. */
async function typedRfcRequestObject(overrides: Record<string, unknown> = {}): Promise<string> {
	let token = new TypedRequestObject({
		iss: RFC9126_CLIENT_ID,
		aud: RFC9126_ISSUER,
		exp: RFC9126_REQUEST_OBJECT_EXP,
		...RFC9126_PARAMETERS,
		...overrides,
	});
	return token.sign(JWK.Algorithm.RS256, [await rfcSigningKey()]);
}

describe("verifyRequestObject", () => {
	test("the RFC 9126 §3 key reproduces the RFC's own request object signature", async () => {
		let [header, payload, signature] = RFC9126_REQUEST_OBJECT.split(".");
		let key = await rfcSigningKey();
		let signed = await crypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			key.private,
			new TextEncoder().encode(`${header}.${payload}`),
		);

		expect(Base64Url.encode(new Uint8Array(signed))).toBe(signature);
	});

	test("refuses the RFC 9126 §3 request object verbatim, which carries no typ header", async () => {
		await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });

		let result = await verifyRequestObject(db, {
			token: RFC9126_REQUEST_OBJECT,
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now: BEFORE_RFC_EXP,
		});

		expect(result.ok).toBe(false);
	});

	test("answers the RFC 9126 §3 claims as parameters once the object is explicitly typed", async () => {
		await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });

		let result = await verifyRequestObject(db, {
			token: await typedRfcRequestObject(),
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now: BEFORE_RFC_EXP,
		});

		expect(result).toEqual({ ok: true, parameters: RFC9126_PARAMETERS });
	});

	test("writes a non-string claim the way it reads as a query parameter", async () => {
		await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });

		let result = await verifyRequestObject(db, {
			token: await typedRfcRequestObject({ max_age: 86400, claims: { userinfo: { email: null } } }),
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now: BEFORE_RFC_EXP,
		});

		expect(result.ok && result.parameters.max_age).toBe("86400");
		expect(result.ok && result.parameters.claims).toBe('{"userinfo":{"email":null}}');
	});

	test.each([
		["has expired", {}, (RFC9126_REQUEST_OBJECT_EXP + 60) * 1000],
		["names another audience", { aud: "https://other.example.com" }, BEFORE_RFC_EXP],
		["names another issuer", { iss: "someone-else" }, BEFORE_RFC_EXP],
		["names another client_id", { client_id: "someone-else" }, BEFORE_RFC_EXP],
		["carries no exp", { exp: undefined }, BEFORE_RFC_EXP],
		["nests a request_uri", { request_uri: "urn:example:nested" }, BEFORE_RFC_EXP],
	])("refuses an object that %s", async (_label, overrides, now) => {
		await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });

		let result = await verifyRequestObject(db, {
			token: await typedRfcRequestObject(overrides),
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now,
		});

		expect(result.ok).toBe(false);
	});

	test("refuses an object signed by a key the client never registered", async () => {
		let stranger = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.RS256));
		await createClient(RFC9126_CLIENT_ID, {
			jwks: { keys: [stranger.jwk as ClientJwks["keys"][0]] },
		});

		let result = await verifyRequestObject(db, {
			token: await typedRfcRequestObject(),
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now: BEFORE_RFC_EXP,
		});

		expect(result.ok).toBe(false);
	});

	test("refuses an object from a client holding no keys", async () => {
		await createClient(RFC9126_CLIENT_ID);

		let result = await verifyRequestObject(db, {
			token: await typedRfcRequestObject(),
			clientId: RFC9126_CLIENT_ID,
			issuer: RFC9126_ISSUER,
			now: BEFORE_RFC_EXP,
		});

		expect(result).toEqual({ ok: false, description: expect.stringContaining("no keys") });
	});

	test("verifies against the key set a client serves from its jwks_uri", async () => {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		server.use(http.get(JWKS_URI, () => HttpResponse.json({ keys: [pair.jwk] })));
		await createClient("client_es256", { jwksUri: JWKS_URI });

		let token = await new TypedRequestObject({
			iss: "client_es256",
			aud: RFC9126_ISSUER,
			exp: "5m",
			...RFC9126_PARAMETERS,
			client_id: "client_es256",
		}).sign(JWK.Algorithm.ES256, [pair]);

		let result = await verifyRequestObject(db, {
			token,
			clientId: "client_es256",
			issuer: RFC9126_ISSUER,
			now: Date.now(),
		});

		expect(result).toEqual({
			ok: true,
			parameters: { ...RFC9126_PARAMETERS, client_id: "client_es256" },
		});
	});
});
