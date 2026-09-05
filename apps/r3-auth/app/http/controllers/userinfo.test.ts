/**
 * Router-level tests of the UserInfo endpoint, focused on scope gating: `sub` is always
 * returned, and every other claim appears only when the access token was issued with the
 * scope that entitles the caller to it. A fault here is reported behind the same challenge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp, withUnreadableSigningKeys } from "~/app/lib/test/http";
import { notesOf, withLog } from "~/app/lib/test/logs";
import { authorizeUrl, exchangeCode, ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Calls the endpoint with a bearer token. */
async function userinfo(accessToken?: string): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.userinfo.href()}`, {
			headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
		}),
	);
}

/** Signs in, then issues an access token carrying exactly the given scopes. */
async function tokenWithScope(scope: string): Promise<string> {
	await signIn(app, fixtures);

	let response = await app.fetch(
		new Request(authorizeUrl(fixtures, { scope }), { redirect: "manual" }),
	);
	let code = new URL(response.headers.get("location")!).searchParams.get("code")!;
	let tokens = (await (await exchangeCode(app, fixtures, { code })).json()) as {
		access_token: string;
	};

	return tokens.access_token;
}

/** Redeems a refresh token at the token endpoint, returning the access token it mints. */
async function tokenFromRefresh(refreshToken: string): Promise<string> {
	let response = await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
		}),
	);
	let tokens = (await response.json()) as { access_token: string };
	return tokens.access_token;
}

/** Mints a client-credentials access token, authenticating the client with HTTP Basic. */
async function clientCredentialsToken(): Promise<string> {
	let basic = btoa(`${fixtures.clientId}:${fixtures.clientSecret}`);
	let response = await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				authorization: `Basic ${basic}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		}),
	);
	let tokens = (await response.json()) as { access_token: string };
	return tokens.access_token;
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /userinfo", () => {
	/** The seeded fixture's email is confirmed, so `email_verified` reports that state. */
	test("returns every claim for openid, email and profile", async () => {
		let response = await userinfo(await tokenWithScope("openid email profile"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			sub: fixtures.subjectId,
			email: "jane@example.com",
			email_verified: true,
			name: "Jane Doe",
			preferred_username: "jane",
			picture: "https://example.com/jane.png",
		});
	});

	test("withholds the profile claims when profile was not granted", async () => {
		let response = await userinfo(await tokenWithScope("openid email"));

		let claims = (await response.json()) as Record<string, unknown>;
		expect(claims.email).toBe("jane@example.com");
		expect(claims).not.toHaveProperty("name");
		expect(claims).not.toHaveProperty("preferred_username");
		expect(claims).not.toHaveProperty("picture");
	});

	test("withholds the email claims when email was not granted", async () => {
		let response = await userinfo(await tokenWithScope("openid profile"));

		let claims = (await response.json()) as Record<string, unknown>;
		expect(claims.name).toBe("Jane Doe");
		expect(claims).not.toHaveProperty("email");
		expect(claims).not.toHaveProperty("email_verified");
	});

	test("returns only sub for a bare openid token", async () => {
		let response = await userinfo(await tokenWithScope("openid"));

		expect(await response.json()).toEqual({ sub: fixtures.subjectId });
	});

	/**
	 * A token minted by the refresh_token grant carries `openid`, so the endpoint can
	 * serve the subject it names.
	 */
	test("serves the subject for a token minted by the refresh_token grant", async () => {
		let { refresh_token } = await signIn(app, fixtures);

		let response = await userinfo(await tokenFromRefresh(refresh_token));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ sub: fixtures.subjectId });
	});

	/**
	 * A client-credentials token's subject is the client itself and carries no `openid`
	 * scope, so the endpoint answers with the ordinary bearer challenge, keeping a
	 * person's claims from reaching a machine caller.
	 */
	test("refuses a client-credentials token cleanly, without a 500", async () => {
		let response = await userinfo(await clientCredentialsToken());

		expect(response.status).toBe(401);
		expect(response.status).not.toBe(500);
		expect(response.headers.get("www-authenticate")).toContain("invalid_token");
		expect(await response.json()).toEqual({
			error: "invalid_token",
			error_description: "Invalid or expired access token",
		});
	});

	test("ignores a scope this server does not grant", async () => {
		let response = await userinfo(await tokenWithScope("openid email offline_access"));

		let claims = (await response.json()) as Record<string, unknown>;
		expect(claims.email).toBe("jane@example.com");
		expect(claims).not.toHaveProperty("name");
	});

	test("answers 401 with a challenge when no token is presented", async () => {
		let response = await userinfo();

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe('Bearer realm="auth.sergiodxa.com"');
		expect(await response.json()).toEqual({
			error: "invalid_token",
			error_description: "Missing or invalid access token",
		});
	});

	test("answers 401 for a token that is not one this server signed", async () => {
		let response = await userinfo("not.a.token");

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toContain("invalid_token");
		expect(await response.json()).toMatchObject({ error: "invalid_token" });
	});

	test("answers 401 once the subject the token names is gone", async () => {
		let accessToken = await tokenWithScope("openid email");

		let { default: Subject } = await import("~/app/data/subject");
		await Subject.delete(app.db, fixtures.subjectId);

		let response = await userinfo(accessToken);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "invalid_token",
			error_description: "Subject not found",
		});
	});

	/**
	 * An unreadable key store leaves every token unverifiable, good ones included, so the
	 * challenge stays the one description a caller earns while the record fails with the
	 * fault, the outcome that pages.
	 */
	test("records unreadable signing keys as a failure behind the same challenge", async () => {
		let accessToken = await tokenWithScope("openid email");

		let [response, record] = await withLog(
			async () => await withUnreadableSigningKeys(app, async () => await userinfo(accessToken)),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "invalid_token",
			error_description: "Invalid or expired access token",
		});

		expect(record).toMatchObject({ outcome: "error", "error.type": "InternalServerError" });
		expect(notesOf(record)).toContainEqual(
			expect.objectContaining({ level: "warn", name: "oidc.userinfo.signing_key_failed" }),
		);
	});
});
