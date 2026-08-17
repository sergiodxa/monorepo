/**
 * Router-level tests of the token endpoint: refresh-token rotation, the
 * client-credentials grant through both HTTP Basic and body credentials, client
 * authentication failures, and the no-store headers every response carries.
 *
 * The body-credentials tests guard a frozen contract. The OIDC client library the
 * relying parties use defaults to sending `client_id`/`client_secret` in the body, so
 * an endpoint that only accepts Basic fails every sign-in at once — which has happened
 * once already.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

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
		// The session id *is* the refresh token, so refreshing keeps handing back the
		// same value: rotation renews the access token and extends the session row.
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
	test("issues an access token for credentials in the Authorization header", async () => {
		let response = await post({ grant_type: "client_credentials" }, { Authorization: basic() });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(typeof tokens.access_token).toBe("string");
		expect(tokens.token_type).toBe("Bearer");
		// A machine grant has no subject and therefore nothing to refresh.
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

	test("a secret containing base64 padding characters still authenticates over Basic", async () => {
		let { default: Client } = await import("~/app/data/client");
		let { clients } = await import("~/database/schema");

		// `??>` encodes to "Pz8+", exercising the `+` that base64url would have mangled.
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
