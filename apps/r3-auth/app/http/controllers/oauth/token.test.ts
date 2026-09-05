/**
 * Router-level tests of the token endpoint: refresh-token rotation, the `offline_access` gate
 * on issuing one, the client-credentials grant, client authentication failures, a fault here
 * told apart from a client's mistake, and the no-store headers. Body credentials are a frozen
 * contract: Basic alone 400s every login.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { withLog } from "~/app/lib/test/logs";
import {
	authorizeUrl,
	exchangeCode,
	ORIGIN,
	seed,
	signIn,
	submitSignIn,
} from "~/app/lib/test/seed";
import routes from "~/routes/web";

/**
 * The `code_verifier` the PKCE exchanges below present. Its `S256` challenge is written out
 * as a constant, so a test can take the digest away and keep the fixture.
 */
const VERIFIER = "test-code-verifier-that-is-long-enough";

/** The unpadded base64url SHA-256 of {@link VERIFIER}. */
const CHALLENGE = "aR4qcDehlTqFSADsPqglVn-eSmvea8v0ge0m7JBXcFw";

let app: TestApp;
let fixtures: Fixtures;

/** The `Authorization` header value for the seeded client's credentials. */
function basic(clientId = fixtures.clientId, secret = fixtures.clientSecret): string {
	return `Basic ${btoa(`${clientId}:${secret}`)}`;
}

/** Posts a form-encoded body to the token endpoint. */
async function post(
	body: Record<string, string>,
	headers: Record<string, string> = {},
): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
			body: new URLSearchParams(body),
		}),
	);
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("POST /oauth/token", () => {
	test("every response forbids caching, success and failure alike", async () => {
		let response = await post({ grant_type: "nonsense" });

		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("pragma")).toBe("no-cache");
	});

	test("an unreadable body is invalid_request", async () => {
		let response = await post({ grant_type: "authorization_code" });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "invalid_request",
			error_description: "Invalid request body",
		});
	});
});

describe("the refresh_token grant", () => {
	/**
	 * The session id *is* the refresh token, so refreshing hands back the same value:
	 * rotation renews the access token and extends the session row.
	 */
	test("returns a new access token and the rotated refresh token", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
		});

		expect(response.status).toBe(200);

		let refreshed = (await response.json()) as Record<string, unknown>;
		expect(typeof refreshed.access_token).toBe("string");
		expect(typeof refreshed.id_token).toBe("string");
		expect(refreshed.access_token).not.toBe(tokens.access_token);
		expect(refreshed.refresh_token).toBe(tokens.refresh_token);
	});

	test("a refresh token whose session was revoked is invalid_grant", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let { default: Session } = await import("~/app/data/session");
		await Session.deleteById(app.db, tokens.refresh_token);

		let response = await post({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_grant" });
	});

	test("an unknown refresh token is invalid_grant", async () => {
		let response = await post({ grant_type: "refresh_token", refresh_token: "not-a-token" });

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_grant" });
	});
});

describe("the client_credentials grant", () => {
	/** A machine grant carries no subject, so the response is an access token alone. */
	test("issues an access token for credentials in the Authorization header", async () => {
		let response = await post({ grant_type: "client_credentials" }, { Authorization: basic() });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(typeof tokens.access_token).toBe("string");
		expect(tokens.token_type).toBe("Bearer");
		expect(tokens.refresh_token).toBeUndefined();
	});

	test("issues an access token for credentials in the request body", async () => {
		let response = await post({
			grant_type: "client_credentials",
			client_id: fixtures.clientId,
			client_secret: fixtures.clientSecret,
		});

		expect(response.status).toBe(200);
		expect(typeof ((await response.json()) as Record<string, unknown>).access_token).toBe("string");
	});

	/**
	 * `??>` encodes to "Pz8+", so the secret exercises the `+` that only standard
	 * base64 produces.
	 */
	test("a secret containing base64 padding characters still authenticates over Basic", async () => {
		let { default: Client } = await import("~/app/data/client");
		let { clients } = await import("~/database/schema");

		let secret = "??>";
		await app.db.updateMany(clients, { secret }, { where: { id: fixtures.clientId } });

		let client = await Client.findById(app.db, fixtures.clientId);
		expect(client?.secret).toBe(secret);

		let response = await post(
			{ grant_type: "client_credentials" },
			{ Authorization: basic(fixtures.clientId, secret) },
		);

		expect(response.status).toBe(200);
	});

	test("refuses a request with no credentials at all", async () => {
		let response = await post({ grant_type: "client_credentials" });

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Basic");
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});

	test("refuses a wrong secret", async () => {
		let response = await post(
			{ grant_type: "client_credentials" },
			{ Authorization: basic(fixtures.clientId, "not-the-secret") },
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});
});

describe("a fault in this server", () => {
	/** Parks an `S256` authorization request, signs in, and returns the code it issued. */
	async function pkceCode(): Promise<string> {
		await app.fetch(
			new Request(
				authorizeUrl(fixtures, { code_challenge: CHALLENGE, code_challenge_method: "S256" }),
			),
		);

		let login = await submitSignIn(app);
		let location = login.headers.get("location");
		if (!location) throw new Error("Sign-in did not redirect back to the client");

		let code = new URL(location).searchParams.get("code");
		if (!code) throw new Error("Sign-in did not produce an authorization code");

		return code;
	}

	/**
	 * A digest the runtime refuses is this server failing while the grant it was handed is
	 * still good, so the client is owed the `500` it retries on, which keeps the code alive,
	 * and the log line is owed the level that pages.
	 */
	test("a refused digest answers server_error and is logged at error", async () => {
		let code = await pkceCode();

		let digest = vi
			.spyOn(crypto.subtle, "digest")
			.mockRejectedValue(new Error("digest unavailable"));

		let [response, record] = await withLog(
			async () => await exchangeCode(app, fixtures, { code, code_verifier: VERIFIER }),
		);
		digest.mockRestore();

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "server_error",
			error_description: "An unexpected error occurred.",
		});
		expect(response.headers.get("cache-control")).toBe("no-store");

		expect(record).toMatchObject({
			outcome: "error",
			"error.type": "InternalServerError",
			"oidc.grant_type": "authorization_code",
		});
	});

	/**
	 * The same code path with the digest working: a verifier that derives a different
	 * challenge is the client's own mistake, so it keeps the `400` and the `invalid_grant`
	 * code RFC 6749 §5.2 names, and leaves the record's outcome the `ok` a refused exchange is.
	 */
	test("a verifier that does not match stays the client's invalid_grant", async () => {
		let code = await pkceCode();

		let [response, record] = await withLog(
			async () =>
				await exchangeCode(app, fixtures, {
					code,
					code_verifier: "a-different-verifier-that-is-long-enough",
				}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_grant" });

		expect(record).toMatchObject({ outcome: "ok", "oidc.error": "invalid_grant" });
	});
});

describe("the offline_access scope", () => {
	/** Signs in against an authorization request for `scope` and returns the code it issued. */
	async function codeFor(scope: string): Promise<string> {
		await app.fetch(new Request(authorizeUrl(fixtures, { scope })));

		let login = await submitSignIn(app);
		let location = login.headers.get("location");
		if (!location) throw new Error("Sign-in did not redirect back to the client");

		let code = new URL(location).searchParams.get("code");
		if (!code) throw new Error("Sign-in did not produce an authorization code");

		return code;
	}

	/**
	 * OIDC Core §11 makes `offline_access` the request for a grant that outlives the
	 * person's presence, and a refresh token is the only thing that delivers it.
	 */
	test("a login that asked for offline_access is answered with a refresh token", async () => {
		let code = await codeFor("openid email profile offline_access");
		let response = await exchangeCode(app, fixtures, { code });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(typeof tokens.refresh_token).toBe("string");
	});

	/**
	 * A login nobody asked to outlive stays as short as the access token it produced, so
	 * a client that never requested offline access cannot renew behind the person's back.
	 */
	test("a login that never asked for offline_access is answered without a refresh token", async () => {
		let code = await codeFor("openid email profile");
		let response = await exchangeCode(app, fixtures, { code });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(tokens.refresh_token).toBeUndefined();
	});

	/**
	 * RFC 6749 §3.3 owes a client the scope it was actually granted whenever that differs
	 * from the one it asked for, which is how a request narrowed on the way through is
	 * discoverable rather than silent.
	 */
	test("the token response names the scope it granted", async () => {
		let code = await codeFor("openid email nonsense");
		let response = await exchangeCode(app, fixtures, { code });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(tokens.scope).toBe("openid email");
	});
});
