/**
 * Router-level tests of revocation and introspection. Both endpoints authenticate the
 * caller over HTTP Basic and both answer opaquely: RFC 7009 requires a `200` whatever
 * the token was, and RFC 7662 requires a bare `{ active: false }`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Session from "~/app/data/session";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** The `Authorization` header value for the seeded client's credentials. */
function basic(clientId = fixtures.clientId, secret = fixtures.clientSecret): string {
	return `Basic ${btoa(`${clientId}:${secret}`)}`;
}

/** Posts a form-encoded body to one of the two endpoints. */
async function post(
	path: string,
	body: Record<string, string>,
	headers: Record<string, string> = {},
): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${path}`, {
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

describe("POST /oauth/revoke", () => {
	test("deletes the session a refresh token names", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post(
			routes.oauth.revoke.href(),
			{ token: tokens.refresh_token },
			{ Authorization: basic() },
		);

		expect(response.status).toBe(200);
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("answers 200 for a token that never existed", async () => {
		let response = await post(
			routes.oauth.revoke.href(),
			{ token: "not-a-token" },
			{ Authorization: basic() },
		);

		expect(response.status).toBe(200);
	});

	test("answers 200 without revoking when the token belongs to another client", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let { default: Client } = await import("~/app/data/client");
		let other = await Client.create(app.db, {
			name: "Other",
			redirect_uri: "https://other.example.com/callback",
			logout_uri: "https://other.example.com/logout",
		});

		let response = await post(
			routes.oauth.revoke.href(),
			{ token: tokens.refresh_token },
			{ Authorization: basic(other.id, other.secret) },
		);

		expect(response.status).toBe(200);
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});

	test("refuses a caller with no credentials", async () => {
		let response = await post(routes.oauth.revoke.href(), { token: "anything" });

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Basic");
	});

	test("an access-token hint is a no-op", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post(
			routes.oauth.revoke.href(),
			{ token: tokens.refresh_token, token_type_hint: "access_token" },
			{ Authorization: basic() },
		);

		expect(response.status).toBe(200);
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});
});

describe("POST /oauth/introspect", () => {
	test("reports a live refresh token as active, with its subject and client", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post(
			routes.oauth.introspect.href(),
			{ token: tokens.refresh_token },
			{ Authorization: basic() },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			active: true,
			sub: fixtures.subjectId,
			client_id: fixtures.clientId,
			token_type: "Bearer",
		});
	});

	test("reports a live access token as active", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post(
			routes.oauth.introspect.href(),
			{ token: tokens.access_token, token_type_hint: "access_token" },
			{ Authorization: basic() },
		);

		expect(await response.json()).toMatchObject({ active: true, sub: fixtures.subjectId });
	});

	/**
	 * Bounded on both sides: a value in the wrong unit still reads as a number, so
	 * seconds land just ahead of now while milliseconds land in the year 58000.
	 */
	test("reports expiry as the seconds since the epoch RFC 7662 asks for", async () => {
		let tokens = await signIn(app, fixtures);
		app.resetCookies();

		let response = await post(
			routes.oauth.introspect.href(),
			{ token: tokens.access_token, token_type_hint: "access_token" },
			{ Authorization: basic() },
		);

		let body = (await response.json()) as { exp: number; iat: number };
		let now = Math.floor(Date.now() / 1000);

		expect(body.exp).toBeGreaterThan(now);
		expect(body.exp).toBeLessThan(now + 24 * 60 * 60);
		expect(body.iat).toBeLessThanOrEqual(now);
		expect(body.iat).toBeGreaterThan(now - 60);
	});

	test("reports an unknown token as inactive without saying why", async () => {
		let response = await post(
			routes.oauth.introspect.href(),
			{ token: "not-a-token" },
			{ Authorization: basic() },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });
	});

	test("refuses a caller with no credentials", async () => {
		let response = await post(routes.oauth.introspect.href(), { token: "anything" });

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});

	/**
	 * The credentials fail inside the engine, so introspection reports the token as
	 * inactive and the endpoint stays opaque either way.
	 */
	test("refuses a caller whose secret is wrong", async () => {
		let response = await post(
			routes.oauth.introspect.href(),
			{ token: "anything" },
			{ Authorization: basic(fixtures.clientId, "wrong") },
		);

		expect(await response.json()).toEqual({ active: false });
	});
});
