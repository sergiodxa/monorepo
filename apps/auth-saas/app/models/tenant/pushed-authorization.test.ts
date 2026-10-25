/**
 * Drives `pushed-authorization.ts` against a real SQLite-backed tenant database: pushing
 * the authorization request RFC 9126 §2.1 prints and the request object §3 prints, then
 * redeeming the minted `request_uri` once, late, twice, and as the wrong client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { JWK, JWT } from "@sdxc/jwt";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { RegisterClientInput } from "~/app/models/tenant/clients";

import { clients, clientSecrets, registerClient } from "~/app/models/tenant/clients";
import {
	pushAuthorizationRequest,
	pushedAuthorizationRequests,
	redeemPushedAuthorizationRequest,
	REQUEST_URI_PREFIX,
	sweepExpiredPushedAuthorizationRequests,
} from "~/app/models/tenant/pushed-authorization";
import {
	RFC9126_CLIENT_ID,
	RFC9126_ISSUER,
	RFC9126_PARAMETERS,
	RFC9126_PRIVATE_JWK,
	RFC9126_PUBLIC_JWK,
	RFC9126_REDIRECT_URI,
	RFC9126_REQUEST_OBJECT_EXP,
} from "~/app/test/rfc9126";
import { runMigrations } from "~/database/tenant-migrations";

/** A moment the RFC's request object has not yet expired at, the clock every push here runs on. */
const NOW = (RFC9126_REQUEST_OBJECT_EXP - 30) * 1000;

/** A request object as RFC 9101 §4 types it, for signing fixtures. */
class TypedRequestObject extends JWT {
	static override type = "oauth-authz-req+jwt";
}

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);
});

/**
 * Registers a confidential `client_secret_basic` client under the given id, the way the
 * RFC's `s6BhdRkqt3` would be set up, and answers its one-time secret.
 */
async function createClient(
	clientId: string,
	overrides: Partial<RegisterClientInput> = {},
): Promise<string> {
	let result = await registerClient(db, {
		name: "PAR client",
		kind: "confidential",
		redirectUris: [RFC9126_REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["account-information"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	});
	if (!result.ok || !result.secret) throw new Error("client refused");
	await db.update(clients, { id: result.client.id }, { id: clientId });
	await db.updateMany(
		clientSecrets,
		{ client_id: clientId },
		{ where: { client_id: result.client.id } },
	);
	return result.secret;
}

/** Pushes the RFC 9126 §2.1 parameters (plus any overrides) as the given client. */
async function push(
	secret: string,
	parameters: Record<string, string> = RFC9126_PARAMETERS,
	clientId = RFC9126_CLIENT_ID,
) {
	return pushAuthorizationRequest(db, {
		clientId,
		clientSecret: secret,
		authScheme: "basic",
		parameters,
		issuer: RFC9126_ISSUER,
		now: NOW,
	});
}

/** Pushes the RFC parameters and answers the minted `request_uri`, failing the test if the push was refused. */
async function pushedRequestUri(secret: string): Promise<string> {
	let result = await push(secret);
	if (result.kind !== "pushed") throw new Error(`push refused: ${result.description}`);
	return result.requestUri;
}

describe("pushAuthorizationRequest", () => {
	test("answers a one-time URN reference and its lifetime for the RFC 9126 §2.1 request", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);

		let result = await push(secret);

		expect(result).toEqual({
			kind: "pushed",
			requestUri: expect.stringMatching(/^urn:ietf:params:oauth:request_uri:[A-Za-z0-9_-]{43}$/),
			expiresIn: 60,
		});
	});

	test("stores the request under a hash of its reference, never the reference itself", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		let requestUri = await pushedRequestUri(secret);

		let rows = await db.findMany(pushedAuthorizationRequests);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).not.toContain(requestUri.slice(REQUEST_URI_PREFIX.length));
		expect(rows[0]?.parameters).toEqual(RFC9126_PARAMETERS);
	});

	test("keeps client authentication members out of the stored request", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);

		await push(secret, { ...RFC9126_PARAMETERS, client_secret: secret });

		let rows = await db.findMany(pushedAuthorizationRequests);
		expect(rows[0]?.parameters).toEqual(RFC9126_PARAMETERS);
	});

	test("refuses a client whose secret does not verify", async () => {
		await createClient(RFC9126_CLIENT_ID);

		let result = await push("csec_wrong");

		expect(result).toMatchObject({ kind: "error", status: 401, error: "invalid_client" });
	});

	test("refuses a pushed request_uri (§2.1)", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);

		let result = await push(secret, { ...RFC9126_PARAMETERS, request_uri: "urn:example:x" });

		expect(result).toMatchObject({ kind: "error", status: 400, error: "invalid_request" });
	});

	test("validates the request as /authorize would, before minting anything", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);

		let unregistered = await push(secret, {
			...RFC9126_PARAMETERS,
			redirect_uri: "https://attacker.example.com/cb",
		});
		let noPkce = await push(secret, { ...RFC9126_PARAMETERS, code_challenge_method: "plain" });
		let outOfCeiling = await push(secret, { ...RFC9126_PARAMETERS, scope: "admin" });

		expect(unregistered).toMatchObject({ kind: "error", status: 400, error: "invalid_request" });
		expect(noPkce).toMatchObject({ kind: "error", status: 400, error: "invalid_request" });
		expect(outOfCeiling).toMatchObject({ kind: "error", status: 400, error: "invalid_scope" });
		expect(await db.findMany(pushedAuthorizationRequests)).toEqual([]);
	});

	test("stores only the request object's claims when one is pushed (§3)", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });
		let key = await crypto.subtle.importKey(
			"jwk",
			RFC9126_PRIVATE_JWK,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["sign"],
		);
		let request = await new TypedRequestObject({
			iss: RFC9126_CLIENT_ID,
			aud: RFC9126_ISSUER,
			exp: RFC9126_REQUEST_OBJECT_EXP,
			...RFC9126_PARAMETERS,
		}).sign(JWK.Algorithm.RS256, [{ id: "k2bdc", alg: JWK.Algorithm.RS256, private: key }]);

		let result = await push(secret, {
			client_id: RFC9126_CLIENT_ID,
			request,
			state: "ignored-outside-the-object",
		});

		expect(result.kind).toBe("pushed");
		let rows = await db.findMany(pushedAuthorizationRequests);
		expect(rows[0]?.parameters).toEqual(RFC9126_PARAMETERS);
	});

	test("refuses a request object that does not verify with invalid_request_object", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID, { jwks: { keys: [RFC9126_PUBLIC_JWK] } });

		let result = await push(secret, { client_id: RFC9126_CLIENT_ID, request: "a.b.c" });

		expect(result).toMatchObject({ kind: "error", status: 400, error: "invalid_request_object" });
	});
});

describe("redeemPushedAuthorizationRequest", () => {
	test("answers the pushed parameters to the client that pushed them", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		let requestUri = await pushedRequestUri(secret);

		let redeemed = await redeemPushedAuthorizationRequest(db, {
			requestUri,
			clientId: RFC9126_CLIENT_ID,
			now: NOW + 1000,
		});

		expect(redeemed).toEqual({ ok: true, parameters: RFC9126_PARAMETERS });
	});

	test("refuses a second redemption of the same reference", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		let requestUri = await pushedRequestUri(secret);
		let input = { requestUri, clientId: RFC9126_CLIENT_ID, now: NOW + 1000 };

		await redeemPushedAuthorizationRequest(db, input);
		let reused = await redeemPushedAuthorizationRequest(db, input);

		expect(reused).toEqual({ ok: false });
	});

	test("refuses a reference whose sixty seconds ran out", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		let requestUri = await pushedRequestUri(secret);

		let expired = await redeemPushedAuthorizationRequest(db, {
			requestUri,
			clientId: RFC9126_CLIENT_ID,
			now: NOW + 60_000,
		});

		expect(expired).toEqual({ ok: false });
	});

	test("refuses another client, and leaves the reference for the client that pushed it", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		await createClient("client_other");
		let requestUri = await pushedRequestUri(secret);

		let mismatched = await redeemPushedAuthorizationRequest(db, {
			requestUri,
			clientId: "client_other",
			now: NOW + 1000,
		});
		let rightful = await redeemPushedAuthorizationRequest(db, {
			requestUri,
			clientId: RFC9126_CLIENT_ID,
			now: NOW + 1000,
		});

		expect(mismatched).toEqual({ ok: false });
		expect(rightful.ok).toBe(true);
	});

	test("refuses a reference the server never minted", async () => {
		let redeemed = await redeemPushedAuthorizationRequest(db, {
			requestUri: "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c",
			clientId: RFC9126_CLIENT_ID,
			now: NOW,
		});

		expect(redeemed).toEqual({ ok: false });
	});
});

describe("sweepExpiredPushedAuthorizationRequests", () => {
	test("removes only the requests whose lifetime ran out", async () => {
		let secret = await createClient(RFC9126_CLIENT_ID);
		await pushedRequestUri(secret);

		let early = await sweepExpiredPushedAuthorizationRequests(db, { now: NOW + 1000 });
		let late = await sweepExpiredPushedAuthorizationRequests(db, { now: NOW + 61_000 });

		expect(early).toEqual({ deleted: 0, more: false });
		expect(late).toEqual({ deleted: 1, more: false });
	});
});
