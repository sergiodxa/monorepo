/**
 * Specs for the two `remix/middleware/auth` schemes, run through the real middleware so
 * the auth state a route reads is what is asserted: a session scheme that renews a lapsed
 * set and signs out a refused one, and a bearer scheme that answers a declined credential
 * with RFC 6750's challenge. Tokens are signed for real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthScheme } from "remix/middleware/auth";

import { JWK } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCookie } from "remix/cookie";
import { Auth, auth } from "remix/middleware/auth";
import { session } from "remix/middleware/session";
import { createRouter, RequestContext } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { AccessToken } from "../access-token.js";
import { AuthError } from "../auth-error.js";
import { AuthSession } from "../auth-session.js";
import { IdToken } from "../id-token.js";
import { Issuer } from "../issuer.js";
import { RelyingParty } from "../relying-party.js";
import { ResourceServer } from "../resource-server.js";

import { sessionOf } from "./context.js";
import { bearerScheme, sessionScheme } from "./schemes.js";

/** Seconds in an hour, the lifetime every fixture token carries. */
const ONE_HOUR = 3600;

/** The issuer every fixture token is signed for. */
const ISSUER = "https://sso.example.com";

/** The client the fixture relying party is registered as. */
const CLIENT_ID = "client-1";

/** The origin the app answers requests on. */
const APP_ORIGIN = "https://app.example.com";

/** The issuer's token endpoint, which a renewal presents the refresh token at. */
const TOKEN_ENDPOINT = `${ISSUER}/token`;

/** Where the issuer publishes the keys every fixture token is verified against. */
const JWKS_URI = `${ISSUER}/jwks`;

let keys: JWK.KeyPair[];
let foreign: JWK.KeyPair[];

let server = setupServer(http.get(JWKS_URI, () => HttpResponse.json(JWK.toJSON(keys))));

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	foreign = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Seconds since the epoch, offset by the given number of seconds. */
function epoch(offset = 0): number {
	return Math.floor(Date.now() / 1000) + offset;
}

/** The fixture issuer, configured inline so no discovery request is needed. */
function createIssuer(): Issuer {
	return new Issuer(ISSUER, {
		metadata: {
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/authorize`,
			token_endpoint: TOKEN_ENDPOINT,
			jwks_uri: JWKS_URI,
		},
	});
}

/** The fixture client. */
function createRelyingParty(): RelyingParty {
	return new RelyingParty(createIssuer(), {
		clientId: CLIENT_ID,
		clientSecret: "s3cr3t",
		redirectUri: `${APP_ORIGIN}/auth/callback`,
	});
}

/** Signs an ID token for the fixture issuer and client. */
function signIdToken(claims: Record<string, unknown> = {}): Promise<string> {
	return new IdToken({ iss: ISSUER, aud: CLIENT_ID, sub: "user-1", exp: "1h", ...claims }).sign(
		JWK.Algorithm.ES256,
		keys,
	);
}

/**
 * Signs an access token carrying the scopes a fixture grant issues.
 *
 * @param claims - Claims layered over the fixture issuer, audience, and subject.
 * @param signingKeys - The keys to sign with.
 */
function signAccessToken(
	claims: Record<string, unknown> = {},
	signingKeys: JWK.KeyPair[] = keys,
): Promise<string> {
	return new AccessToken({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "user-1",
		client_id: CLIENT_ID,
		scope: "openid monitors:read",
		exp: "1h",
		...claims,
	}).sign(JWK.Algorithm.ES256, signingKeys);
}

/**
 * A token set the session scheme finds in the session, with the expiry a test dictates
 * on both the stored record and the access token's own `exp`.
 *
 * @param expiresAt - Seconds since the epoch the set lapses at.
 * @param refreshToken - The refresh token the grant carried, and `null` for a grant
 *   made without `offline_access`, which is a set nothing can renew.
 */
async function storedTokens(
	expiresAt: number,
	refreshToken: string | null = "refresh-1",
): Promise<AuthSession.Tokens> {
	return {
		idToken: await signIdToken(),
		accessToken: await signAccessToken({ exp: expiresAt }),
		refreshToken,
		expiresAt,
	};
}

/** What a request resolved to, and whether the scheme left the session signed in. */
interface Resolved {
	/** The auth state `auth()` stored on the request context. */
	auth: unknown;
	/** Whether the session still holds a token set once the scheme has run. */
	signedIn: boolean;
}

/**
 * Runs one request through the real session and auth middlewares, seeding the session
 * in a middleware ahead of `auth()` so the scheme reads it the way it does in production.
 *
 * @param scheme - The scheme under test.
 * @param tokens - The token set to seed, or `null` for a signed-out request.
 */
async function resolveSession(
	scheme: AuthScheme<unknown>,
	tokens: AuthSession.Tokens | null,
): Promise<Resolved> {
	let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
	let router = createRouter({
		middleware: [
			session(cookie, createMemorySessionStorage()),
			(ctx, next) => {
				if (tokens) AuthSession.write(sessionOf(ctx), tokens);
				return next();
			},
			auth({ schemes: [scheme] }),
		],
	});

	router.get("/probe", (ctx) =>
		Response.json({ auth: ctx.auth, signedIn: AuthSession.from(sessionOf(ctx)) !== null }),
	);

	let response = await router.fetch(new Request(`${APP_ORIGIN}/probe`));
	return response.json() as Promise<Resolved>;
}

/**
 * Runs a bearer scheme through `auth()` against a request carrying the given header,
 * and reports the auth state a route would read.
 *
 * @param scheme - The scheme under test.
 * @param authorization - The header value, omitted for a request carrying none.
 */
async function resolveBearer(scheme: AuthScheme<unknown>, authorization?: string) {
	let headers: Record<string, string> = {};
	if (authorization !== undefined) headers.authorization = authorization;

	let context = new RequestContext(new Request(`${APP_ORIGIN}/monitors`, { headers }));
	await auth({ schemes: [scheme] })(context, () => Promise.resolve(new Response("ok")));

	return context.get(Auth);
}

/** Answers every token request with the given response. */
function stubTokenEndpoint(build: () => Promise<Response> | Response): { calls: number } {
	let seen = { calls: 0 };
	server.use(
		http.post(TOKEN_ENDPOINT, () => {
			seen.calls += 1;
			return build();
		}),
	);
	return seen;
}

describe("sessionScheme", () => {
	test("skips a request nobody is signed in on", async () => {
		let scheme = sessionScheme(createRelyingParty(), {
			verify: (auth) => ({ id: auth.idToken.subject }),
		});

		let resolved = await resolveSession(scheme, null);

		expect(resolved.auth).toEqual({ ok: false });
	});

	test("resolves the app's identity from a live session", async () => {
		let scheme = sessionScheme(createRelyingParty(), {
			verify: (auth) => ({ id: auth.idToken.subject }),
		});

		let resolved = await resolveSession(scheme, await storedTokens(epoch(ONE_HOUR)));

		expect(resolved.auth).toEqual({
			ok: true,
			identity: { id: "user-1" },
			method: "oidc-session",
		});
	});

	test("reports the name the scheme was given", async () => {
		let scheme = sessionScheme(createRelyingParty(), { name: "sso", verify: () => ({ id: "u" }) });

		let resolved = await resolveSession(scheme, await storedTokens(epoch(ONE_HOUR)));

		expect(resolved.auth).toMatchObject({ ok: true, method: "sso" });
	});

	test("renews an access token that has reached its expiry", async () => {
		let scheme = sessionScheme(createRelyingParty(), {
			verify: (auth) => ({ scopes: auth.accessToken.scopes }),
		});
		stubTokenEndpoint(async () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: await signAccessToken({ scope: "openid monitors:write" }),
				expires_in: ONE_HOUR,
			}),
		);

		let resolved = await resolveSession(scheme, await storedTokens(epoch(-1)));

		expect(resolved.auth).toEqual({
			ok: true,
			identity: { scopes: ["openid", "monitors:write"] },
			method: "oidc-session",
		});
	});

	/**
	 * A grant made without `offline_access` carries no refresh token, so its expiry was
	 * never renewable. Ending the session over that would sign a person out every hour;
	 * the claims verified when the set was written still name who is here.
	 */
	test("keeps a session with no refresh token signed in past its expiry", async () => {
		let scheme = sessionScheme(createRelyingParty(), {
			verify: (auth) => ({ id: auth.idToken.subject }),
		});
		let endpoint = stubTokenEndpoint(() => HttpResponse.json({ error: "invalid_grant" }));

		let resolved = await resolveSession(scheme, await storedTokens(epoch(-1), null));

		expect(resolved.auth).toEqual({
			ok: true,
			identity: { id: "user-1" },
			method: "oidc-session",
		});
		expect(resolved.signedIn).toBe(true);
		expect(endpoint.calls).toBe(0);
	});

	test("signs the request out when the renewal is refused", async () => {
		let scheme = sessionScheme(createRelyingParty(), {
			verify: (auth) => ({ id: auth.idToken.subject }),
		});
		stubTokenEndpoint(() => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }));

		let resolved = await resolveSession(scheme, await storedTokens(epoch(-1)));

		expect(resolved.auth).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
		expect(resolved.signedIn).toBe(false);
	});

	test("fails the request when the subject resolves to no identity", async () => {
		let scheme = sessionScheme(createRelyingParty(), { verify: () => null });

		let resolved = await resolveSession(scheme, await storedTokens(epoch(ONE_HOUR)));

		expect(resolved.auth).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
	});
});

describe("bearerScheme", () => {
	/** A resource server over the fixture issuer, answering for the fixture client. */
	function createResourceServer(): ResourceServer {
		return new ResourceServer(createIssuer(), { audience: CLIENT_ID });
	}

	test("resolves a bearer token the issuer stands behind into an identity", async () => {
		let scheme = bearerScheme(createResourceServer(), {
			verify: (token) => ({ clientId: token.clientId }),
		});

		expect(await resolveBearer(scheme, `Bearer ${await signAccessToken()}`)).toEqual({
			ok: true,
			identity: { clientId: CLIENT_ID },
			method: "bearer",
		});
	});

	test("reports the method name it was given", async () => {
		let scheme = bearerScheme(createResourceServer(), {
			name: "api",
			verify: (token) => token.subject,
		});

		expect(await resolveBearer(scheme, `Bearer ${await signAccessToken()}`)).toEqual({
			ok: true,
			identity: "user-1",
			method: "api",
		});
	});

	test("leaves a request carrying no bearer credential to the next scheme", async () => {
		let scheme = bearerScheme(createResourceServer(), { verify: (token) => token.subject });

		expect(await resolveBearer(scheme)).toEqual({ ok: false });
		expect(await resolveBearer(scheme, `Basic ${btoa("user:password")}`)).toEqual({ ok: false });
	});

	test("reports a credential the server declines with RFC 6750's challenge", async () => {
		let scheme = bearerScheme(createResourceServer(), { verify: (token) => token.subject });

		expect(
			await resolveBearer(scheme, `Bearer ${await signAccessToken({}, foreign)}`),
		).toMatchObject({
			ok: false,
			error: {
				code: "invalid_credentials",
				method: "bearer",
				challenge: `Bearer error="invalid_token"`,
			},
		});
	});

	test("reports a caller the app declines as a failure", async () => {
		let scheme = bearerScheme(createResourceServer(), { verify: () => null });

		expect(await resolveBearer(scheme, `Bearer ${await signAccessToken()}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("lets an unreadable key set out of the scheme instead of refusing the caller", async () => {
		server.use(http.get(JWKS_URI, () => new HttpResponse(null, { status: 500 })));
		let scheme = bearerScheme(createResourceServer(), { verify: (token) => token.subject });

		await expect(resolveBearer(scheme, `Bearer ${await signAccessToken()}`)).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, "jwks_failed"),
		);
	});
});
