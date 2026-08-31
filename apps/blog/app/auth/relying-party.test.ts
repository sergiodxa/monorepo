/**
 * Specs for the login the CMS runs on: the transaction a redirect leaves in the
 * session, the code exchange, and the ID-token verification the provider's answer has
 * to pass before any claim reaches the local account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RelyingParty } from "@pkg/auth/relying-party";

import { AuthError, AuthErrorCode } from "@pkg/auth/auth-error";
import { createKVNamespace } from "@pkg/cloudflare-mocks";
import { JWK, JWT } from "@pkg/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { AuthProfile } from "~/app/auth/relying-party";

import { relyingParty } from "~/app/auth/relying-party";
import createEnvMiddleware from "~/app/http/middleware/env";
import routes from "~/routes/web";

/** The origin the blog answers on, which every login destination is held to. */
const APP_ORIGIN = "https://blog.test";

/** The identifier the provider writes as `iss`, scheme-less as it publishes it. */
const ISSUER = "auth.sergiodxa.com";

/** Where the provider serves the endpoints a login reaches. */
const ISSUER_ORIGIN = "https://auth.sergiodxa.com";

/** The client the blog is registered as at the provider. */
const CLIENT_ID = "blog-client";

/** The secret the blog presents at the token endpoint. */
const CLIENT_SECRET = "s3cr3t";

/** The subject the fixture tokens are issued for. */
const SUBJECT = "subject-1";

/** The claims a login fills the account fields from. */
const PROFILE_CLAIMS = {
	email: "sergio@example.com",
	name: "Sergio",
	preferred_username: "sergiodxa",
	picture: "https://example.com/avatar.png",
};

/** The destinations that resolve to another origin while looking local. */
const OPEN_REDIRECT_PAYLOADS = ["//evil.com", "/\\/evil.com", "/\\evil.com", "/..//evil.com"];

let keys: JWK.KeyPair[];
let otherKeys: JWK.KeyPair[];

/** Serves the key set for the whole file, so a per-test reset leaves it published. */
let server = setupServer(
	http.get(`${ISSUER_ORIGIN}/.well-known/jwks.json`, () => HttpResponse.json(JWK.toJSON(keys))),
);

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The bindings the app reads its client credentials and its caches out of. */
function createEnv(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID,
		CLIENT_SECRET,
		COOKIE_SESSION_SECRET: "cookie-secret",
		AUTH: createKVNamespace(),
		REDIRECTS: createKVNamespace(),
		CACHE: createKVNamespace(),
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => undefined,
	};
}

/**
 * Signs an ID token the way the provider does, scheme-less `iss` included.
 *
 * @param claims Claims layered over the fixture subject, audience, and profile.
 * @param signingKeys The keys to sign with, for a token the provider never signed.
 */
function signIdToken(
	claims: Record<string, unknown> = {},
	signingKeys: JWK.KeyPair[] = keys,
): Promise<string> {
	return new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: SUBJECT,
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...PROFILE_CLAIMS,
		...claims,
	}).sign(JWK.Algorithm.ES256, signingKeys);
}

/** Signs the access token a grant carries, which the flow reads for its scopes. */
function signAccessToken(): Promise<string> {
	return new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: SUBJECT,
		client_id: CLIENT_ID,
		scope: "openid profile email",
		exp: "1h",
	}).sign(JWK.Algorithm.ES256, keys);
}

/** What the token endpoint was asked, recorded for the exchange's own assertions. */
interface TokenExchange {
	/** The form body the exchange posted. */
	body: URLSearchParams | null;
	/** The `Authorization` header, which carries the client's credentials. */
	authorization: string | null;
}

/**
 * Answers the token endpoint with a grant carrying `idToken`, recording what the
 * exchange presented to get it.
 *
 * @param idToken The ID token the grant carries.
 * @param accessToken The access token issued beside it.
 */
function serveToken(idToken: string, accessToken: string): TokenExchange {
	let exchange: TokenExchange = { body: null, authorization: null };

	server.use(
		http.post(`${ISSUER_ORIGIN}/oauth/token`, async ({ request }) => {
			exchange.authorization = request.headers.get("authorization");
			exchange.body = new URLSearchParams(await request.text());

			return HttpResponse.json({
				access_token: accessToken,
				token_type: "Bearer",
				expires_in: 3600,
				refresh_token: "refresh-token",
				id_token: idToken,
			});
		}),
	);

	return exchange;
}

/** What one login attempt produced, of which exactly one member is filled. */
interface Attempt {
	/** Where the browser was sent to authenticate. */
	authorization: URL;
	/** What the token endpoint was asked for the code. */
	exchange: TokenExchange;
	/** The grant, for a login the provider's answer completed. */
	grant: RelyingParty.Grant<AuthProfile> | null;
	/** What the callback refused with, for an answer that failed a check. */
	error: unknown;
}

/**
 * Runs a login from the redirect to the grant over one cookie jar, so the transaction
 * travels between the two requests the way it does in a browser.
 *
 * @param options The claims the provider answers with, the keys it signs with, and the
 *   destination the login asks to come back to.
 */
async function attemptLogin(
	options: {
		claims?: Record<string, unknown>;
		signingKeys?: JWK.KeyPair[];
		next?: string;
	} = {},
): Promise<Attempt> {
	let cookie = createCookie("blog-test", { secrets: ["test-secret"] });
	let jar: string | null = null;
	let outcome: Attempt = {
		authorization: new URL(APP_ORIGIN),
		exchange: { body: null, authorization: null },
		grant: null,
		error: null,
	};

	let router = createRouter({
		middleware: [
			createEnvMiddleware(createEnv()),
			asyncContext(),
			session(cookie, createMemorySessionStorage()),
		],
	});

	router.get(routes.auth.login.index, (ctx) =>
		relyingParty(ctx.url).authorize(ctx, { returnTo: ctx.url.searchParams.get("next") }),
	);

	router.get(routes.auth.callback, async (ctx) => {
		try {
			outcome.grant = await relyingParty(ctx.url).callback(ctx);
		} catch (error) {
			outcome.error = error;
		}

		return new Response("done");
	});

	async function visit(path: string): Promise<Response> {
		let headers = new Headers();
		if (jar) headers.set("cookie", jar);

		let response = await router.fetch(
			new Request(new URL(path, APP_ORIGIN), { headers, redirect: "manual" }),
		);

		let setCookie = response.headers.get("set-cookie");
		if (setCookie) jar = setCookie.split(";")[0] ?? jar;

		return response;
	}

	let loginPath = routes.auth.login.index.href();
	let started = await visit(
		options.next ? `${loginPath}?next=${encodeURIComponent(options.next)}` : loginPath,
	);
	outcome.authorization = new URL(started.headers.get("location") ?? APP_ORIGIN);

	let idToken = await signIdToken(
		{ nonce: outcome.authorization.searchParams.get("nonce"), ...options.claims },
		options.signingKeys,
	);
	outcome.exchange = serveToken(idToken, await signAccessToken());

	let state = outcome.authorization.searchParams.get("state") ?? "";
	await visit(`${routes.auth.callback.href()}?code=auth-code&state=${state}`);

	return outcome;
}

describe("relyingParty", () => {
	test("asks the provider for a login bound to the transaction it stored", async () => {
		let { authorization } = await attemptLogin();

		expect(authorization.origin).toBe(ISSUER_ORIGIN);
		expect(authorization.pathname).toBe("/authorize");
		expect(authorization.searchParams.get("client_id")).toBe(CLIENT_ID);
		expect(authorization.searchParams.get("response_type")).toBe("code");
		expect(authorization.searchParams.get("scope")).toBe("openid profile email");
		expect(authorization.searchParams.get("redirect_uri")).toBe(
			`${APP_ORIGIN}${routes.auth.callback.href()}`,
		);
		expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
		expect(authorization.searchParams.get("code_challenge")).toBeTruthy();
		expect(authorization.searchParams.get("state")).toBeTruthy();
		expect(authorization.searchParams.get("nonce")).toBeTruthy();
	});

	test("verifies the provider's answer and maps its claims onto the account fields", async () => {
		let { grant, error } = await attemptLogin();

		expect(error).toBeNull();
		expect(grant?.subject).toBe(SUBJECT);
		expect(grant?.profile).toEqual({
			email: PROFILE_CLAIMS.email,
			avatar: PROFILE_CLAIMS.picture,
			username: PROFILE_CLAIMS.preferred_username,
			displayName: PROFILE_CLAIMS.name,
		});
	});

	test("presents the client's credentials and the PKCE verifier at the token endpoint", async () => {
		let { exchange } = await attemptLogin();

		expect(exchange.authorization).toBe(`Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`);
		expect(exchange.body?.get("grant_type")).toBe("authorization_code");
		expect(exchange.body?.get("code")).toBe("auth-code");
		expect(exchange.body?.get("code_verifier")).toBeTruthy();
		expect(exchange.body?.get("redirect_uri")).toBe(`${APP_ORIGIN}${routes.auth.callback.href()}`);
	});

	test("comes back to the destination the login asked for", async () => {
		let { grant } = await attemptLogin({ next: routes.cms.articles.index.href() });

		expect(grant?.returnTo).toBe(routes.cms.articles.index.href());
	});

	test.each(OPEN_REDIRECT_PAYLOADS)(
		"drops a destination resolving off this origin: %s",
		async (payload) => {
			let { grant } = await attemptLogin({ next: payload });

			expect(grant?.returnTo).toBe(routes.cms.dashboard.href());
		},
	);

	test("refuses a token signed with a key the provider does not publish", async () => {
		let { grant, error } = await attemptLogin({ signingKeys: otherKeys });

		expect(grant).toBeNull();
		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("refuses a token naming an issuer other than the one the provider publishes", async () => {
		let { grant, error } = await attemptLogin({ claims: { iss: ISSUER_ORIGIN } });

		expect(grant).toBeNull();
		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("refuses a token issued for another client", async () => {
		let { grant, error } = await attemptLogin({ claims: { aud: "another-client" } });

		expect(grant).toBeNull();
		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("refuses a token answering a login this session never started", async () => {
		let { grant, error } = await attemptLogin({ claims: { nonce: "another-login" } });

		expect(grant).toBeNull();
		expect(AuthError.is(error, AuthErrorCode.NonceMismatch)).toBe(true);
	});

	test("refuses a token carrying no email, which the account has no room to omit", async () => {
		let { grant, error } = await attemptLogin({ claims: { email: undefined } });

		expect(grant).toBeNull();
		expect(error).toBeInstanceOf(Error);
	});
});
