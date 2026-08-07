/**
 * Router-level tests of the UserInfo endpoint, focused on scope gating: `sub` is
 * always returned, and every other claim appears only when the access token was issued
 * with the scope that entitles the caller to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
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

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /userinfo", () => {
	test("returns every claim for openid, email and profile", async () => {
		let response = await userinfo(await tokenWithScope("openid email profile"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			sub: fixtures.subjectId,
			email: "jane@example.com",
			// The fixture's address is confirmed, and the claim reports the column as it is.
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
});
