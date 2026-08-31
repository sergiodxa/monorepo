/**
 * End-to-end specs for the admin panel's login flow, driven through
 * `createBlogEngine(...).fetch()` so the per-blog issuer, the session cookie, and the
 * role a completed login lands on are all exercised the way a request exercises them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { JWK, JWT } from "@pkg/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { BlogEngine } from "../index";

import { createBlogEngine } from "../index";
import { createSqliteDatabaseAdapter } from "../shared/test/db";

/** The origin the blog answers on, which every redirect target is held to. */
const APP_ORIGIN = "https://blog.example.com";

/** The provider the blog's administrators sign in through. */
const ISSUER = "https://auth.example.com";

/** The client this blog is registered as at the provider. */
const CLIENT_ID = "blog-admin";

/** The address the blog's owner is allow-listed under. */
const OWNER_EMAIL = "owner@example.com";

/** The subject the provider issues for the blog's owner. */
const OWNER_SUBJECT = "subject-1";

/** Where the provider publishes the keys every ID token is verified against. */
const JWKS_URI = `${ISSUER}/jwks`;

/** The provider's token endpoint, the one outbound call a login makes. */
const TOKEN_ENDPOINT = `${ISSUER}/token`;

/** The provider's userinfo endpoint, read only for claims an ID token leaves out. */
const USER_INFO_ENDPOINT = `${ISSUER}/userinfo`;

/** The provider's RP-initiated logout endpoint. */
const END_SESSION_ENDPOINT = `${ISSUER}/end-session`;

/**
 * The headers a browser submits an HTML form with, written out rather than left to a
 * `URLSearchParams` body, which the request interceptor cannot re-read.
 */
const FORM_POST_HEADERS = { "content-type": "application/x-www-form-urlencoded" };

/**
 * MSW server intercepting the provider's endpoints. The key set is served for the
 * whole file, so a per-test handler reset leaves ID-token verification working, and
 * an unhandled request fails the test, which is what proves a round-trip was skipped.
 */
let server = setupServer(http.get(JWKS_URI, () => HttpResponse.json(JWK.toJSON(keys))));

let keys: JWK.KeyPair[];

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Builds a blog whose owner is allow-listed by email and whose first sign-in claims
 * no admin role of its own, which is how a multi-tenant host provisions one.
 *
 * @returns The engine and the SQLite handle its rows can be read back from.
 */
function createEngine() {
	let sqliteDb = openDatabase(":memory:");
	let engine = createBlogEngine({
		database: createSqliteDatabaseAdapter(sqliteDb),
		auth: {
			issuer: ISSUER,
			clientId: CLIENT_ID,
			clientSecret: "test-secret",
			admins: [OWNER_EMAIL],
			bootstrapFirstAdmin: false,
			metadata: {
				issuer: ISSUER,
				authorization_endpoint: `${ISSUER}/authorize`,
				token_endpoint: TOKEN_ENDPOINT,
				jwks_uri: JWKS_URI,
				userinfo_endpoint: USER_INFO_ENDPOINT,
				end_session_endpoint: END_SESSION_ENDPOINT,
			},
		},
		session: { secret: "session-secret" },
	});
	return { engine, sqliteDb };
}

/**
 * Reads a header the flow is asserted on, failing loudly rather than asserting
 * against an empty string.
 *
 * @param response - The response to read.
 * @param name - The header to read.
 * @returns The header's value.
 */
function header(response: Response, name: string): string {
	let value = response.headers.get(name);
	if (value === null) throw new Error(`The response carries no ${name} header`);
	return value;
}

/**
 * Reads a query parameter the flow is asserted on.
 *
 * @param url - The URL to read.
 * @param name - The parameter to read.
 * @returns The parameter's value.
 */
function param(url: URL, name: string): string {
	let value = url.searchParams.get(name);
	if (value === null) throw new Error(`The URL carries no ${name} parameter`);
	return value;
}

/**
 * The cookie header a browser sends back after a response set one, which is what
 * carries the login transaction from the redirect to the callback.
 *
 * @param response - The response whose `Set-Cookie` the browser stored.
 * @returns The `Cookie` header value.
 */
function cookieFrom(response: Response): string {
	return header(response, "set-cookie").split(";")[0] ?? "";
}

/** Signs an ID token for this blog's provider and client. */
function signIdToken(claims: Record<string, unknown>): Promise<string> {
	return new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: OWNER_SUBJECT,
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);
}

/** Signs the access token the grant issues beside the ID token. */
function signAccessToken(): Promise<string> {
	return new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: OWNER_SUBJECT,
		client_id: CLIENT_ID,
		scope: "openid profile email",
		exp: "1h",
	}).sign(JWK.Algorithm.ES256, keys);
}

/**
 * Runs a whole login: starts the flow, answers the token endpoint with an ID token
 * carrying the `nonce` the redirect asked for, and follows the callback.
 *
 * @param engine - The blog to sign into.
 * @param claims - The claims the provider puts in the ID token.
 * @param next - Where the login is asked to return to.
 * @returns The authorization redirect, the callback response, and its cookie.
 */
async function signIn(engine: BlogEngine, claims: Record<string, unknown>, next = "/cms/users") {
	let start = await engine.fetch(
		new Request(`${APP_ORIGIN}/auth/login?next=${encodeURIComponent(next)}`, {
			method: "POST",
			headers: FORM_POST_HEADERS,
			body: "",
		}),
	);

	let authorize = new URL(header(start, "location"));
	let idToken = await signIdToken({ ...claims, nonce: param(authorize, "nonce") });
	let accessToken = await signAccessToken();

	server.use(
		http.post(TOKEN_ENDPOINT, () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: accessToken,
				id_token: idToken,
				expires_in: 3600,
			}),
		),
	);

	let callback = await engine.fetch(
		new Request(
			`${APP_ORIGIN}/auth/callback?code=the-code&state=${encodeURIComponent(param(authorize, "state"))}`,
			{ headers: { cookie: cookieFrom(start) } },
		),
	);

	return { start, authorize, callback, cookie: cookieFrom(callback) };
}

/** Reads the single user row a login created. */
function storedUser(sqliteDb: ReturnType<typeof openDatabase>): Record<string, unknown> {
	let rows = sqliteDb.query("select * from users").all() as Record<string, unknown>[];
	expect(rows).toHaveLength(1);
	return rows[0] ?? {};
}

describe("the admin panel's OIDC login", () => {
	test("asks for a nonce and a PKCE challenge the browser never sees", async () => {
		let { engine } = createEngine();
		let { authorize } = await signIn(engine, { email: OWNER_EMAIL, name: "The Owner" });

		expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/authorize`);
		expect(param(authorize, "response_type")).toBe("code");
		expect(param(authorize, "client_id")).toBe(CLIENT_ID);
		expect(param(authorize, "redirect_uri")).toBe(`${APP_ORIGIN}/auth/callback`);
		expect(param(authorize, "code_challenge_method")).toBe("S256");
		expect(param(authorize, "nonce")).not.toBe(param(authorize, "state"));
	});

	/**
	 * No userinfo handler is registered, so the unhandled-request guard fails this
	 * test if the flow spends a third round-trip on claims the ID token already holds.
	 */
	test("signs the allow-listed owner in from the ID token alone", async () => {
		let { engine, sqliteDb } = createEngine();
		let { callback, cookie } = await signIn(engine, {
			email: OWNER_EMAIL,
			name: "The Owner",
			preferred_username: "owner",
			picture: "https://cdn.example.com/owner.png",
		});

		expect(callback.status).toBe(303);
		expect(callback.headers.get("location")).toBe("/cms/users");

		expect(storedUser(sqliteDb)).toMatchObject({
			subject_id: OWNER_SUBJECT,
			email: OWNER_EMAIL,
			username: "owner",
			display_name: "The Owner",
			avatar: "https://cdn.example.com/owner.png",
		});

		let panel = await engine.fetch(new Request(`${APP_ORIGIN}/cms/users`, { headers: { cookie } }));
		expect(panel.status).toBe(200);
	});

	/**
	 * A provider that keeps the display claims out of its ID tokens would otherwise
	 * leave `email` empty, which reads as "not the owner" and lands the blog's own
	 * owner on the reader role.
	 */
	test("reads the display claims from userinfo when the ID token carries none", async () => {
		let { engine, sqliteDb } = createEngine();
		let requested: string[] = [];

		server.use(
			http.get(USER_INFO_ENDPOINT, ({ request }) => {
				requested.push(request.headers.get("authorization") ?? "");
				return HttpResponse.json({
					sub: OWNER_SUBJECT,
					email: OWNER_EMAIL,
					name: "The Owner",
					preferred_username: "owner",
				});
			}),
		);

		let { callback, cookie } = await signIn(engine, {});

		expect(requested).toHaveLength(1);
		expect(requested[0]).toMatch(/^Bearer /);
		expect(callback.status).toBe(303);
		expect(storedUser(sqliteDb)).toMatchObject({ email: OWNER_EMAIL, display_name: "The Owner" });

		let panel = await engine.fetch(new Request(`${APP_ORIGIN}/cms/users`, { headers: { cookie } }));
		expect(panel.status).toBe(200);
	});

	test("refuses a callback whose state answers no login this session started", async () => {
		let { engine, sqliteDb } = createEngine();
		let response = await engine.fetch(
			new Request(`${APP_ORIGIN}/auth/callback?code=the-code&state=forged`),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/auth/login?error=authentication_failed");
		expect(sqliteDb.query("select * from users").all()).toHaveLength(0);
	});

	test("ends the provider's session with the ID token the login stored", async () => {
		let { engine } = createEngine();
		let { cookie } = await signIn(engine, {
			email: OWNER_EMAIL,
			name: "The Owner",
			preferred_username: "owner",
			picture: "https://cdn.example.com/owner.png",
		});

		let response = await engine.fetch(
			new Request(`${APP_ORIGIN}/auth/logout`, {
				method: "POST",
				headers: { ...FORM_POST_HEADERS, cookie },
				body: "",
			}),
		);

		expect(response.status).toBe(303);
		let logout = new URL(header(response, "location"));
		expect(logout.origin + logout.pathname).toBe(END_SESSION_ENDPOINT);
		expect(param(logout, "id_token_hint").split(".")).toHaveLength(3);
		expect(param(logout, "post_logout_redirect_uri")).toBe(`${APP_ORIGIN}/`);
		expect(response.headers.get("clear-site-data")).toBe('"*"');
	});
});
