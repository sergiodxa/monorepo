/**
 * Router-level tests of the token endpoint: refresh-token rotation, the
 * client-credentials grant through both HTTP Basic and body credentials, client
 * authentication failures, how a fault here is told apart from a client's mistake, and
 * the no-store headers every response carries.
 *
 * The body-credentials tests guard a frozen contract: the relying parties' OIDC client
 * library defaults to sending `client_id`/`client_secret` in the body, so accepting
 * Basic alone fails every sign-in at once — which has happened once already.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { loggedEvents, withLogs } from "~/app/lib/test/logs";
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
 * The `code_verifier` the PKCE exchanges below present. Its `S256` challenge is written
 * down rather than derived, so a test can take the digest away and keep the fixture.
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
	 * still good, so the client is owed the `500` it retries on rather than a `400` that
	 * would have it discard the code — and the log line is owed the level that pages.
	 */
	test("a refused digest answers server_error and is logged at error", async () => {
		let code = await pkceCode();

		let digest = vi
			.spyOn(crypto.subtle, "digest")
			.mockRejectedValue(new Error("digest unavailable"));

		let [response, logs] = await withLogs(
			async () => await exchangeCode(app, fixtures, { code, code_verifier: VERIFIER }),
		);
		digest.mockRestore();

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "server_error",
			error_description: "An unexpected error occurred.",
		});
		expect(response.headers.get("cache-control")).toBe("no-store");

		expect(loggedEvents(logs.error)).toContainEqual(
			expect.objectContaining({ level: "error", event: "token_server_error" }),
		);
	});

	/**
	 * The same code path with the digest working: a verifier that derives a different
	 * challenge is the client's own mistake, so it keeps the `400` and the `invalid_grant`
	 * code RFC 6749 §5.2 names, and stays at the level a refused exchange belongs on.
	 */
	test("a verifier that does not match stays the client's invalid_grant", async () => {
		let code = await pkceCode();

		let [response, logs] = await withLogs(
			async () =>
				await exchangeCode(app, fixtures, {
					code,
					code_verifier: "a-different-verifier-that-is-long-enough",
				}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_grant" });

		expect(loggedEvents(logs.info)).toContainEqual(
			expect.objectContaining({ level: "info", event: "token_oauth2_error" }),
		);
	});
});
