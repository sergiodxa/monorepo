/**
 * Specs for the browser login flow, driven through a real session middleware and
 * a cookie jar so the transaction travels the way it does in production. Every
 * correlation value, the PKCE derivation, the `returnTo` payloads that were live
 * exploits, and the step-up contract are asserted end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";
import type { Adapter, RateLimitDecision } from "@pkg/rate-limit";
import type { Result } from "@pkg/result";
import type { AuthScheme } from "remix/middleware/auth";

import { catchResponse } from "@pkg/catch-response-middleware";
import { JWK } from "@pkg/jwt";
import { MemoryAdapter, RateLimitError } from "@pkg/rate-limit";
import { failure } from "@pkg/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCookie } from "remix/cookie";
import { auth } from "remix/middleware/auth";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { AuthError, AuthErrorCode } from "./auth-error";
import { AuthSession } from "./auth-session";
import { IdToken } from "./id-token";
import { Issuer } from "./issuer";
import { RelyingParty } from "./relying-party";

/** Seconds in an hour, the lifetime every fixture token carries. */
const ONE_HOUR = 3600;

/** The issuer every fixture token is signed for. */
const ISSUER = "https://sso.example.com";

/** The client the fixture relying party is registered as. */
const CLIENT_ID = "client-1";

/** The secret the fixture client presents at the token endpoint. */
const CLIENT_SECRET = "s3cr3t";

/** The origin the app answers requests on, which every `returnTo` is held to. */
const APP_ORIGIN = "https://app.example.com";

/** The callback the fixture client is registered with. */
const REDIRECT_URI = `${APP_ORIGIN}/auth/callback`;

/** The issuer's authorization endpoint. */
const AUTHORIZATION_ENDPOINT = `${ISSUER}/authorize`;

/** The issuer's token endpoint, the one outbound request a login makes. */
const TOKEN_ENDPOINT = `${ISSUER}/token`;

/** The issuer's RP-initiated logout endpoint. */
const END_SESSION_ENDPOINT = `${ISSUER}/end-session`;

/** The issuer's userinfo endpoint. */
const USER_INFO_ENDPOINT = `${ISSUER}/userinfo`;

/** Where the issuer publishes the keys every fixture token is verified against. */
const JWKS_URI = `${ISSUER}/jwks`;

/** Where the issuer publishes its discovery document, per OpenID Connect Discovery §4. */
const DISCOVERY_ENDPOINT = `${ISSUER}/.well-known/openid-configuration`;

/** The IP the edge reports for the fixture browser. */
const CLIENT_IP = "203.0.113.10";

/** The session key the login transaction occupies, read to assert what was stored. */
const TRANSACTION_SESSION_KEY = "auth:transaction";

/** The redirect targets that resolve to an attacker's origin despite looking local. */
const OPEN_REDIRECT_PAYLOADS = ["//evil.com", "/\\/evil.com", "/\\evil.com", "/..//evil.com"];

/**
 * MSW server intercepting the issuer's endpoints. The key set is served for the
 * whole file, so a per-test handler reset leaves verification working.
 */
let server = setupServer(http.get(JWKS_URI, () => HttpResponse.json(JWK.toJSON(keys))));

let keys: JWK.KeyPair[];
let otherKeys: JWK.KeyPair[];
let edwardsKeys: JWK.KeyPair[];

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	edwardsKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.EdDSA))];
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Encodes bytes as unpadded base64url, the encoding a PKCE challenge travels in. */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Derives an S256 challenge independently of the implementation under test. */
async function challengeOf(verifier: string): Promise<string> {
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return base64url(new Uint8Array(digest));
}

/**
 * Computes the `at_hash` an access token commits to, under the digest the ID
 * token's `alg` selects.
 *
 * @param accessToken - The access token the ID token is bound to.
 * @param digest - The digest the signing algorithm calls for, SHA-256 by default.
 */
async function atHashOf(accessToken: string, digest = "SHA-256"): Promise<string> {
	let hash = new Uint8Array(
		await crypto.subtle.digest(digest, new TextEncoder().encode(accessToken)),
	);
	return base64url(hash.slice(0, hash.length / 2));
}

/**
 * Signs an ID token with the Edwards key set, whose `EdDSA` header selects the
 * SHA-512 `at_hash` digest.
 *
 * @param claims - Claims layered over the fixture issuer, audience, and subject.
 */
function signEdwardsIdToken(claims: Record<string, unknown> = {}): Promise<string> {
	return new IdToken({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "user-1",
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...claims,
	}).sign(JWK.Algorithm.EdDSA, edwardsKeys);
}

/** Signs an ID token for the fixture issuer and client. */
function signIdToken(
	claims: Record<string, unknown> = {},
	signingKeys: JWK.KeyPair[] = keys,
): Promise<string> {
	return new IdToken({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "user-1",
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...claims,
	}).sign(JWK.Algorithm.ES256, signingKeys);
}

/** Signs an access token carrying the scopes a fixture grant issues. */
function signAccessToken(claims: Record<string, unknown> = {}): Promise<string> {
	return new IdToken({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "user-1",
		client_id: CLIENT_ID,
		scope: "openid monitors:read",
		exp: "1h",
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);
}

/** The fixture issuer, configured inline so no discovery request is needed. */
function createIssuer(metadata: Partial<Issuer.Metadata> = {}): Issuer {
	return new Issuer(ISSUER, {
		metadata: {
			issuer: ISSUER,
			authorization_endpoint: AUTHORIZATION_ENDPOINT,
			token_endpoint: TOKEN_ENDPOINT,
			jwks_uri: JWKS_URI,
			end_session_endpoint: END_SESSION_ENDPOINT,
			userinfo_endpoint: USER_INFO_ENDPOINT,
			...metadata,
		},
	});
}

/** The fixture client's credentials, before any per-test override. */
function createRelyingParty<profile = RelyingParty.Profile>(
	options: Partial<RelyingParty.Options<profile>> = {},
	metadata: Partial<Issuer.Metadata> = {},
): RelyingParty<profile> {
	return new RelyingParty<profile>(createIssuer(metadata), {
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		redirectUri: REDIRECT_URI,
		...options,
	} as RelyingParty.Options<profile>);
}

/**
 * A limiter whose backend is down, standing in for the outage a login is asked to
 * keep working through.
 */
class UnreachableAdapter implements Adapter {
	/** Budget the adapter would enforce if it could reach its backend. */
	readonly limit = 1;

	/** Window the adapter would count in if it could reach its backend. */
	readonly window: DurationInput = "1 minute";

	/** Reports the outage as a failure, which is how an adapter states it cannot answer. */
	async consume(key: string): Promise<Result<RateLimitDecision, RateLimitError>> {
		return failure(new RateLimitError("The backend is unreachable.", { backend: "kv", key }));
	}

	/** Reports the same outage for a reset. */
	async reset(key: string): Promise<Result<void, RateLimitError>> {
		return failure(new RateLimitError("The backend is unreachable.", { backend: "kv", key }));
	}
}

/** A browser: one cookie jar, one router, and the real session middleware. */
interface Agent {
	/**
	 * Visits a route and runs one flow method on its context, carrying the session
	 * cookie forward the way a browser does.
	 *
	 * @param path - The route to visit, query string included.
	 * @param action - The flow method to run against the request context.
	 */
	run<value>(path: string, action: (ctx: RelyingParty.Context) => Promise<value>): Promise<value>;
	/**
	 * Visits a route expecting the flow method to throw, and answers with what it threw.
	 *
	 * @param path - The route to visit, query string included.
	 * @param action - The flow method expected to fail.
	 */
	attempt(path: string, action: (ctx: RelyingParty.Context) => Promise<unknown>): Promise<unknown>;
}

/**
 * Builds an agent whose session cookie survives between visits.
 *
 * @param clientIp - The IP the edge reports for this browser, sent as
 *   `CF-Connecting-IP` so a rate limit keys on it the way it does in production.
 */
function createAgent(clientIp: string | null = null): Agent {
	let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();
	let jar: string | null = null;
	let action: (ctx: RelyingParty.Context) => Promise<unknown> = async () => null;
	let outcome: { ok: true; value: unknown } | { ok: false; error: unknown } = {
		ok: true,
		value: null,
	};

	let router = createRouter({ middleware: [session(cookie, storage)] });
	let handler = async (ctx: RelyingParty.Context) => {
		try {
			outcome = { ok: true, value: await action(ctx) };
		} catch (error) {
			outcome = { ok: false, error };
		}
		return new Response("done");
	};

	router.get("/login", handler);
	router.get("/auth/callback", handler);
	router.get("/logout", handler);
	router.get("/probe", handler);

	async function visit(path: string): Promise<void> {
		let headers = new Headers();
		if (jar) headers.set("cookie", jar);
		if (clientIp) headers.set("CF-Connecting-IP", clientIp);

		let response = await router.fetch(new Request(new URL(path, APP_ORIGIN), { headers }));
		let setCookie = response.headers.get("set-cookie");
		if (setCookie) jar = setCookie.split(";")[0] ?? jar;
	}

	return {
		async run(path, next) {
			action = next as (ctx: RelyingParty.Context) => Promise<unknown>;
			await visit(path);
			if (!outcome.ok) throw outcome.error;
			return outcome.value as never;
		},
		async attempt(path, next) {
			action = next;
			await visit(path);
			if (outcome.ok) throw new Error(`Expected ${path} to fail, it answered instead`);
			return outcome.error;
		},
	};
}

/**
 * Mounts the login route the way an app does, with `catchResponse()` below the
 * session middleware, so `authorize` answers the request for itself.
 *
 * @param rp - The client whose login route is mounted.
 * @returns Visits `/login` as the browser at `clientIp`.
 */
function createLoginApp(
	rp: Pick<RelyingParty<unknown>, "authorize">,
): (clientIp: string) => Promise<Response> {
	let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	let router = createRouter({ middleware: [session(cookie, storage), catchResponse()] });
	router.get("/login", (ctx) => rp.authorize(ctx));

	return (clientIp) =>
		router.fetch(
			new Request(`${APP_ORIGIN}/login`, {
				headers: { "CF-Connecting-IP": clientIp },
				redirect: "manual",
			}),
		);
}

/** What the token endpoint saw, for asserting the grant and the client credentials. */
interface TokenRequest {
	/** The form body the exchange posted. */
	body: URLSearchParams | null;
	/** The `Authorization` header, present under `client_secret_basic`. */
	authorization: string | null;
}

/**
 * Intercepts the token endpoint, recording what the exchange presented.
 *
 * @param build - Answers the exchange, given the body it posted.
 */
function stubTokenEndpoint(
	build: (body: URLSearchParams) => Promise<Response> | Response,
): TokenRequest {
	let request: TokenRequest = { body: null, authorization: null };

	server.use(
		http.post(TOKEN_ENDPOINT, async ({ request: incoming }) => {
			request.authorization = incoming.headers.get("authorization");
			request.body = new URLSearchParams(await incoming.text());
			return build(request.body);
		}),
	);

	return request;
}

/** Builds the token response a healthy exchange answers with. */
async function tokenResponse(
	options: {
		nonce?: string | null;
		claims?: Record<string, unknown>;
		atHash?: boolean;
		signingKeys?: JWK.KeyPair[];
		refreshToken?: string | null;
	} = {},
): Promise<Response> {
	let accessToken = await signAccessToken();
	let claims: Record<string, unknown> = { ...options.claims };
	if (options.nonce) claims.nonce = options.nonce;
	if (options.atHash !== false) claims.at_hash = await atHashOf(accessToken);

	return HttpResponse.json({
		token_type: "Bearer",
		access_token: accessToken,
		id_token: await signIdToken(claims, options.signingKeys ?? keys),
		refresh_token:
			options.refreshToken === null ? undefined : (options.refreshToken ?? "refresh-1"),
		expires_in: ONE_HOUR,
	});
}

/**
 * Re-serves an answer's body under exactly the media type a test names, and under
 * none when it names none, so the header alone decides how the answer is read.
 *
 * @param answer - The response whose body travels on.
 * @param contentType - The media type the provider declares, left off when absent.
 */
async function declaredAs(answer: Response, contentType?: string): Promise<Response> {
	let body = await answer.text();
	let headers = contentType === undefined ? undefined : { "content-type": contentType };
	return new HttpResponse(new Blob([body]), { headers });
}

/** The authorization request the login redirect carries. */
function authorizeParams(response: Response): URLSearchParams {
	return new URL(response.headers.get("location") ?? "", ISSUER).searchParams;
}

/** Starts a login and answers with the authorization request it produced. */
async function startLogin(
	agent: Agent,
	rp: Pick<RelyingParty<unknown>, "authorize">,
	options: RelyingParty.AuthorizeOptions = {},
): Promise<URLSearchParams> {
	let response = await agent.run("/login", (ctx) => rp.authorize(ctx, options));
	return authorizeParams(response);
}

/**
 * Serves the issuer's discovery document, counting what asked for it, so a login
 * can be shown to have asked the issuer for nothing.
 */
function stubDiscovery(): { count: number } {
	let seen = { count: 0 };

	server.use(
		http.get(DISCOVERY_ENDPOINT, () => {
			seen.count += 1;
			return HttpResponse.json({
				issuer: ISSUER,
				authorization_endpoint: AUTHORIZATION_ENDPOINT,
				token_endpoint: TOKEN_ENDPOINT,
				jwks_uri: JWKS_URI,
			});
		}),
	);

	return seen;
}

/**
 * The fixture client over an issuer it has to discover, so the first login it
 * starts costs an outbound request.
 *
 * @param options - Overrides for the client's standing options.
 */
function createDiscoveringRelyingParty(options: Partial<RelyingParty.Options> = {}): RelyingParty {
	return new RelyingParty(new Issuer(ISSUER), {
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		redirectUri: REDIRECT_URI,
		...options,
	});
}

/** The callback URL for a code and the `state` the login was started with. */
function callbackPath(params: Record<string, string>): string {
	return `/auth/callback?${new URLSearchParams(params).toString()}`;
}

describe("authorize", () => {
	test("sends the browser on with a 303, so a form post is followed by a GET", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let response = await agent.run("/login", (ctx) => rp.authorize(ctx));

		expect(response.status).toBe(303);
	});

	test("redirects to the authorization endpoint with every required parameter", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let response = await agent.run("/login", (ctx) => rp.authorize(ctx));
		let params = authorizeParams(response);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toContain(AUTHORIZATION_ENDPOINT);
		expect(params.get("response_type")).toBe("code");
		expect(params.get("client_id")).toBe(CLIENT_ID);
		expect(params.get("redirect_uri")).toBe(REDIRECT_URI);
		expect(params.get("scope")).toBe("openid profile email");
		expect(params.get("code_challenge_method")).toBe("S256");
		expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		expect(params.get("nonce")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		expect(params.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
	});

	test("asks for the scopes the login names, in place of the client's", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ scopes: ["openid"] });

		let params = await startLogin(agent, rp, { scopes: ["openid", "offline_access"] });

		expect(params.get("scope")).toBe("openid offline_access");
	});

	test("sends acr_values, max_age, and prompt when the login asks for step-up", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let params = await startLogin(agent, rp, {
			acrValues: ["urn:mfa"],
			maxAge: 300,
			prompt: "login",
		});

		expect(params.get("acr_values")).toBe("urn:mfa");
		expect(params.get("max_age")).toBe("300");
		expect(params.get("prompt")).toBe("login");
	});

	test("counts a duration string as the seconds max_age travels in", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let params = await startLogin(agent, rp, { maxAge: "5 minutes" });

		expect(params.get("max_age")).toBe("300");
	});

	test("merges the extra parameters the client and the login supply", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ authorizationParams: { ui_locales: "es" } });

		let params = await startLogin(agent, rp, { authorizationParams: { login_hint: "ada@x.com" } });

		expect(params.get("ui_locales")).toBe("es");
		expect(params.get("login_hint")).toBe("ada@x.com");
	});

	test("throws when the session middleware has not run", async () => {
		let rp = createRelyingParty();
		let router = createRouter({ middleware: [] });
		router.get("/login", (ctx) => rp.authorize(ctx));

		await expect(router.fetch(new Request(`${APP_ORIGIN}/login`))).rejects.toThrow(
			/remix\/middleware\/session/,
		);
	});
});

describe("authorize returnTo", () => {
	/** Reads the transaction the login stored, which never travels to the browser. */
	async function storedReturnTo(agent: Agent): Promise<unknown> {
		return agent.run("/probe", async (ctx) => {
			let stored = ctx.get(Session)?.get(TRANSACTION_SESSION_KEY);
			return (stored as { returnTo?: unknown } | undefined)?.returnTo;
		});
	}

	test("keeps a target that names this app's own origin", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		await startLogin(agent, rp, { returnTo: "/dashboard?tab=monitors" });

		expect(await storedReturnTo(agent)).toBe("/dashboard?tab=monitors");
	});

	test("takes the fallback when the login names no target", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ fallbackReturnTo: "/home" });

		await startLogin(agent, rp);

		expect(await storedReturnTo(agent)).toBe("/home");
	});

	for (let payload of OPEN_REDIRECT_PAYLOADS) {
		test(`refuses ${payload} and takes the fallback`, async () => {
			let agent = createAgent();
			let rp = createRelyingParty({ fallbackReturnTo: "/home" });

			await startLogin(agent, rp, { returnTo: payload });

			expect(await storedReturnTo(agent)).toBe("/home");
		});
	}

	test("refuses a target on another origin", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		await startLogin(agent, rp, { returnTo: "https://evil.com/dashboard" });

		expect(await storedReturnTo(agent)).toBe("/");
	});
});

describe("reserved parameters", () => {
	for (let name of [
		"state",
		"client_id",
		"redirect_uri",
		"response_type",
		"scope",
		"code_challenge",
		"code_challenge_method",
		"nonce",
	]) {
		test(`refuses ${name} in the client's authorization parameters`, () => {
			let error: unknown;
			try {
				createRelyingParty({ authorizationParams: { [name]: "attacker" } });
			} catch (thrown) {
				error = thrown;
			}

			expect(AuthError.is(error, AuthErrorCode.ReservedParameter)).toBe(true);
		});

		test(`refuses ${name} in one login's authorization parameters`, async () => {
			let agent = createAgent();
			let rp = createRelyingParty();

			let error = await agent.attempt("/login", (ctx) =>
				rp.authorize(ctx, { authorizationParams: { [name]: "attacker" } }),
			);

			expect(AuthError.is(error, AuthErrorCode.ReservedParameter)).toBe(true);
		});
	}

	for (let name of ["grant_type", "code", "code_verifier", "client_secret"]) {
		test(`refuses ${name} in the client's token parameters`, () => {
			let error: unknown;
			try {
				createRelyingParty({ tokenParams: { [name]: "attacker" } });
			} catch (thrown) {
				error = thrown;
			}

			expect(AuthError.is(error, AuthErrorCode.ReservedParameter)).toBe(true);
		});
	}
});

describe("callback", () => {
	test("completes a login and signs the request in", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp, { returnTo: "/dashboard" });

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.idToken.subject).toBe("user-1");
		expect(grant.subject).toBe("user-1");
		expect(grant.accessToken.has("monitors:read")).toBe(true);
		expect(grant.refreshToken).toBe("refresh-1");
		expect(grant.returnTo).toBe("/dashboard");

		expect(request.body?.get("grant_type")).toBe("authorization_code");
		expect(request.body?.get("code")).toBe("code-1");
		expect(request.body?.get("redirect_uri")).toBe(REDIRECT_URI);

		let auth = await agent.run("/probe", async (ctx) => AuthSession.from(ctx));
		expect(auth?.idToken.subject).toBe("user-1");
		expect(auth?.expired).toBe(false);
	});

	test("presents a code_verifier whose S256 digest is the challenge it published", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));

		await agent.run(callbackPath({ code: "code-1", state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		let verifier = request.body?.get("code_verifier") ?? "";
		expect(verifier).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		expect(await challengeOf(verifier)).toBe(params.get("code_challenge"));
	});

	test("throws state_mismatch when the callback echoes another login's state", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await startLogin(agent, rp);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: "someone-else" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.StateMismatch)).toBe(true);
	});

	test("throws missing_transaction when the session holds no login", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let error = await agent.attempt(callbackPath({ code: "code-1", state: "any" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.MissingTransaction)).toBe(true);
	});

	test("spends the transaction on the first callback, so a replay finds none", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);
		let state = params.get("state") ?? "";

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		await agent.run(callbackPath({ code: "code-1", state }), (ctx) => rp.callback(ctx));

		let error = await agent.attempt(callbackPath({ code: "code-1", state }), (ctx) =>
			rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.MissingTransaction)).toBe(true);
	});

	test("throws authorization_failed carrying the issuer's own error", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		let error = await agent.attempt(
			callbackPath({
				error: "access_denied",
				error_description: "The person said no",
				state: params.get("state") ?? "",
			}),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.AuthorizationFailed)).toBe(true);
		expect((error as AuthError).providerError).toBe("access_denied");
		expect((error as AuthError).providerErrorDescription).toBe("The person said no");
	});

	test("throws authorization_failed when the callback carries no response at all", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await startLogin(agent, rp);

		let error = await agent.attempt(callbackPath({}), (ctx) => rp.callback(ctx));

		expect(AuthError.is(error, AuthErrorCode.AuthorizationFailed)).toBe(true);
	});

	test("throws missing_code when the callback carries neither a code nor an error", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		let error = await agent.attempt(callbackPath({ state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.MissingCode)).toBe(true);
	});

	test("throws nonce_mismatch when the ID token answers another login", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: "someone-elses-nonce" }));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.NonceMismatch)).toBe(true);
	});

	test("throws nonce_mismatch when the ID token carries no nonce at all", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: null }));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.NonceMismatch)).toBe(true);
	});

	test("throws at_hash_mismatch when the ID token names a different access token", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(async () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: await signAccessToken(),
				id_token: await signIdToken({
					nonce: params.get("nonce"),
					at_hash: await atHashOf("some-other-access-token"),
				}),
				expires_in: ONE_HOUR,
			}),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.AtHashMismatch)).toBe(true);
	});

	test("verifies an at_hash taken with the digest the ID token's alg selects", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		server.use(http.get(JWKS_URI, () => HttpResponse.json(JWK.toJSON(edwardsKeys))));
		stubTokenEndpoint(async () => {
			let accessToken = await signAccessToken();
			return HttpResponse.json({
				token_type: "Bearer",
				access_token: accessToken,
				id_token: await signEdwardsIdToken({
					nonce: params.get("nonce"),
					at_hash: await atHashOf(accessToken, "SHA-512"),
				}),
				expires_in: ONE_HOUR,
			});
		});

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.subject).toBe("user-1");
	});

	test("throws at_hash_mismatch for an at_hash taken with the wrong digest", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		server.use(http.get(JWKS_URI, () => HttpResponse.json(JWK.toJSON(edwardsKeys))));
		stubTokenEndpoint(async () => {
			let accessToken = await signAccessToken();
			return HttpResponse.json({
				token_type: "Bearer",
				access_token: accessToken,
				id_token: await signEdwardsIdToken({
					nonce: params.get("nonce"),
					at_hash: await atHashOf(accessToken, "SHA-256"),
				}),
				expires_in: ONE_HOUR,
			});
		});

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.AtHashMismatch)).toBe(true);
	});

	test("completes a login whose ID token carries no at_hash", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce"), atHash: false }));

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.idToken.atHash).toBeNull();
		expect(grant.subject).toBe("user-1");
	});

	test("throws invalid_token for an ID token signed by another key", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({ nonce: params.get("nonce"), signingKeys: otherKeys, atHash: false }),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("throws missing_id_token when the grant answered without one", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(async () =>
			HttpResponse.json({ token_type: "Bearer", access_token: await signAccessToken() }),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.MissingIdToken)).toBe(true);
	});

	test("throws token_request_failed carrying the issuer's refusal", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			HttpResponse.json(
				{ error: "invalid_grant", error_description: "The code has been used" },
				{ status: 400 },
			),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.TokenRequestFailed)).toBe(true);
		expect((error as AuthError).providerError).toBe("invalid_grant");
	});

	test("throws token_request_failed for a response carrying no access token", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => HttpResponse.json({ token_type: "Bearer" }));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.TokenRequestFailed)).toBe(true);
	});
	test("reports a runtime that declines the `at_hash` digest as a local fault", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);
		let answer = await tokenResponse({ nonce: params.get("nonce") });

		stubTokenEndpoint(() => answer);

		let digest = vi.spyOn(crypto.subtle, "digest").mockRejectedValue(new Error("no digest here"));

		try {
			let error = await agent.attempt(
				callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
				(ctx) => rp.callback(ctx),
			);

			expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(false);
			expect(error).toBeInstanceOf(Error);
			expect(error).not.toHaveProperty("code");
			expect((error as Error).message).toContain("WebCrypto");
		} finally {
			digest.mockRestore();
		}
	});

	test("throws token_request_failed for a grant declared as HTML, naming the type", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(async () =>
			declaredAs(await tokenResponse({ nonce: params.get("nonce") }), "text/html"),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.TokenRequestFailed)).toBe(true);
		expect((error as AuthError).message).toContain("text/html");
	});

	test("reads a grant from an answer that declares no media type", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(async () => declaredAs(await tokenResponse({ nonce: params.get("nonce") })));

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.subject).toBe("user-1");
	});
});

describe("client authentication", () => {
	test("posts the credentials in the body by default", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		await agent.run(callbackPath({ code: "code-1", state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(request.body?.get("client_id")).toBe(CLIENT_ID);
		expect(request.body?.get("client_secret")).toBe(CLIENT_SECRET);
		expect(request.authorization).toBeNull();
	});

	test("presents the credentials as Basic when the client asks for it", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ clientAuth: "client_secret_basic" });
		let params = await startLogin(agent, rp);

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		await agent.run(callbackPath({ code: "code-1", state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(request.authorization).toBe(`Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`);
		expect(request.body?.get("client_secret")).toBeNull();
	});

	test("form-encodes a non-ASCII client secret before it reaches the Basic header", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ clientAuth: "client_secret_basic", clientSecret: "sécret£" });
		let params = await startLogin(agent, rp);

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		await agent.run(callbackPath({ code: "code-1", state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(request.authorization).toBe("Basic Y2xpZW50LTE6cyVDMyVBOWNyZXQlQzIlQTM=");
	});

	test("sends the client's extra token parameters", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ tokenParams: { resource: "https://api.example.com" } });
		let params = await startLogin(agent, rp);

		let request = stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		await agent.run(callbackPath({ code: "code-1", state: params.get("state") ?? "" }), (ctx) =>
			rp.callback(ctx),
		);

		expect(request.body?.get("resource")).toBe("https://api.example.com");
	});
});

describe("step-up", () => {
	/** Runs a login that asks for step-up and answers it with the given claims. */
	async function stepUp(
		options: RelyingParty.AuthorizeOptions,
		claims: Record<string, unknown>,
	): Promise<{ agent: Agent; rp: RelyingParty<RelyingParty.Profile>; path: string }> {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp, options);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce"), claims }));

		return {
			agent,
			rp,
			path: callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
		};
	}

	test("accepts a response whose acr is one of the requested contexts", async () => {
		let { agent, rp, path } = await stepUp(
			{ acrValues: ["urn:mfa", "urn:pwd"] },
			{ acr: "urn:mfa" },
		);

		let grant = await agent.run(path, (ctx) => rp.callback(ctx));

		expect(grant.idToken.acr).toBe("urn:mfa");
	});

	test("accepts a response that answers acr_values through amr", async () => {
		let { agent, rp, path } = await stepUp({ acrValues: ["mfa"] }, { amr: ["pwd", "mfa"] });

		let grant = await agent.run(path, (ctx) => rp.callback(ctx));

		expect(grant.idToken.amr).toContain("mfa");
	});

	test("throws acr_not_satisfied when the provider ignored acr_values", async () => {
		let { agent, rp, path } = await stepUp({ acrValues: ["urn:mfa"] }, {});

		let error = await agent.attempt(path, (ctx) => rp.callback(ctx));

		expect(AuthError.is(error, AuthErrorCode.AcrNotSatisfied)).toBe(true);
	});

	test("throws acr_not_satisfied when the provider answered another context", async () => {
		let { agent, rp, path } = await stepUp({ acrValues: ["urn:mfa"] }, { acr: "urn:pwd" });

		let error = await agent.attempt(path, (ctx) => rp.callback(ctx));

		expect(AuthError.is(error, AuthErrorCode.AcrNotSatisfied)).toBe(true);
	});

	test("accepts a max_age answered with a fresh auth_time", async () => {
		let { agent, rp, path } = await stepUp(
			{ maxAge: 300 },
			{ auth_time: Math.floor(Date.now() / 1000) - 10 },
		);

		let grant = await agent.run(path, (ctx) => rp.callback(ctx));

		expect(grant.idToken.authTime).toBeInstanceOf(Date);
	});

	test("throws max_age_not_satisfied when auth_time is absent", async () => {
		let { agent, rp, path } = await stepUp({ maxAge: 300 }, {});

		let error = await agent.attempt(path, (ctx) => rp.callback(ctx));

		expect(AuthError.is(error, AuthErrorCode.MaxAgeNotSatisfied)).toBe(true);
	});

	test("throws max_age_not_satisfied when auth_time is older than the window", async () => {
		let { agent, rp, path } = await stepUp(
			{ maxAge: 300 },
			{ auth_time: Math.floor(Date.now() / 1000) - ONE_HOUR },
		);

		let error = await agent.attempt(path, (ctx) => rp.callback(ctx));

		expect(AuthError.is(error, AuthErrorCode.MaxAgeNotSatisfied)).toBe(true);
	});
});

describe("mfa", () => {
	test("reads the configured values off amr", () => {
		let rp = createRelyingParty({ mfa: ["mfa", "urn:passkey"] });

		expect(rp.mfa(new IdToken({ sub: "user-1", amr: ["pwd", "urn:passkey"] }))).toBe(true);
	});

	test("falls back to acr for a provider that populates that instead", () => {
		let rp = createRelyingParty({ mfa: ["urn:mfa"] });

		expect(rp.mfa(new IdToken({ sub: "user-1", acr: "urn:mfa" }))).toBe(true);
	});

	test("answers false for a token reporting neither", () => {
		let rp = createRelyingParty();

		expect(rp.mfa(new IdToken({ sub: "user-1", amr: ["pwd"] }))).toBe(false);
	});
});

describe("overrides", () => {
	test("maps the profile the app asked for", async () => {
		let agent = createAgent();
		let rp = createRelyingParty<{ label: string; scopes: string[] }>({
			mapProfile(claims, tokens) {
				return { label: String(claims.email), scopes: tokens.accessToken.scopes };
			},
		});
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({ nonce: params.get("nonce"), claims: { email: "ada@example.com" } }),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile).toEqual({
			label: "ada@example.com",
			scopes: ["openid", "monitors:read"],
		});
	});

	test("builds the display claims into a profile when the app maps none", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({
				nonce: params.get("nonce"),
				claims: { name: "Ada Lovelace", email: "ada@example.com", email_verified: true },
			}),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile).toEqual({
			name: "Ada Lovelace",
			email: "ada@example.com",
			emailVerified: true,
			username: null,
			picture: null,
		});
	});

	test("leaves the subject to the subject hook, out of the profile's reach", async () => {
		let agent = createAgent();
		let rp = createRelyingParty<{ subject: string }>({
			mapProfile() {
				return { subject: "profile-tried-to-set-this" };
			},
			subject(claims) {
				return `tenant:${String(claims.sub)}`;
			},
		});
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.subject).toBe("tenant:user-1");
		expect(grant.profile.subject).toBe("profile-tried-to-set-this");
	});

	test("reads the userinfo endpoint when the client always asks for it", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(
			http.get(USER_INFO_ENDPOINT, () =>
				HttpResponse.json({ sub: "user-1", name: "Ada Lovelace" }),
			),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.claims.name).toBe("Ada Lovelace");
		expect(grant.profile.name).toBe("Ada Lovelace");
	});

	test("throws invalid_token when the userinfo response names another subject", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(http.get(USER_INFO_ENDPOINT, () => HttpResponse.json({ sub: "someone-else" })));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("throws user_info_failed when the userinfo endpoint refuses the call", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(
			http.get(USER_INFO_ENDPOINT, () =>
				HttpResponse.json({ error: "invalid_token" }, { status: 401 }),
			),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.UserInfoFailed)).toBe(true);
	});

	test("throws user_info_failed when the userinfo endpoint answers with something other than JSON", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(http.get(USER_INFO_ENDPOINT, () => HttpResponse.text("<html>gateway</html>")));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.UserInfoFailed)).toBe(true);
	});

	test("throws user_info_failed for claims declared as HTML, naming the type", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(
			http.get(USER_INFO_ENDPOINT, () =>
				declaredAs(HttpResponse.json({ sub: "user-1", name: "Ada" }), "text/html"),
			),
		);

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.UserInfoFailed)).toBe(true);
		expect((error as AuthError).message).toContain("text/html");
	});

	test("reads claims from an answer that declares no media type", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(
			http.get(USER_INFO_ENDPOINT, () =>
				declaredAs(HttpResponse.json({ sub: "user-1", name: "Ada" })),
			),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile.name).toBe("Ada");
	});

	test("leans on the ID token when every profile claim is already there", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "when-missing" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({
				nonce: params.get("nonce"),
				claims: {
					name: "Ada Lovelace",
					email: "ada@example.com",
					preferred_username: "ada",
					picture: "https://example.com/ada.png",
				},
			}),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile.name).toBe("Ada Lovelace");
		expect(grant.profile.email).toBe("ada@example.com");
	});

	test("reads the userinfo endpoint for a claim the ID token withholds", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "when-missing" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({ nonce: params.get("nonce"), claims: { name: "Ada Lovelace" } }),
		);
		server.use(
			http.get(USER_INFO_ENDPOINT, () =>
				HttpResponse.json({ sub: "user-1", email: "ada@example.com" }),
			),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile.name).toBe("Ada Lovelace");
		expect(grant.profile.email).toBe("ada@example.com");
	});

	test("leaves the userinfo endpoint alone when the client never asks for it", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "never" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() =>
			tokenResponse({ nonce: params.get("nonce"), claims: { name: "Ada Lovelace" } }),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile.name).toBe("Ada Lovelace");
		expect(grant.profile.email).toBeNull();
	});

	test("throws endpoint_unsupported when the issuer advertises no userinfo endpoint", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "always" }, { userinfo_endpoint: undefined });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));

		let error = await agent.attempt(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(AuthError.is(error, AuthErrorCode.EndpointUnsupported)).toBe(true);
	});

	test("reads the userinfo endpoint when the ID token carries no profile claims", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({ userInfo: "when-missing" });
		let params = await startLogin(agent, rp);

		stubTokenEndpoint(() => tokenResponse({ nonce: params.get("nonce") }));
		server.use(
			http.get(USER_INFO_ENDPOINT, () => HttpResponse.json({ sub: "user-1", name: "Ada" })),
		);

		let grant = await agent.run(
			callbackPath({ code: "code-1", state: params.get("state") ?? "" }),
			(ctx) => rp.callback(ctx),
		);

		expect(grant.profile.name).toBe("Ada");
	});
});

describe("rateLimit", () => {
	test("starts a login while the budget holds", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 2, window: "1 minute" }) });

		let first = await startLogin(agent, rp);
		let second = await startLogin(agent, rp);

		expect(first.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		expect(second.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
	});

	test("throws a 429 response once the browser's budget is spent", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 1, window: "1 minute" }) });

		await startLogin(agent, rp);
		let thrown = await agent.attempt("/login", (ctx) => rp.authorize(ctx));

		expect(thrown).toBeInstanceOf(Response);
		expect((thrown as Response).status).toBe(429);
	});

	test("describes the spent budget in the response's rate limit fields", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 1, window: "1 minute" }) });

		await startLogin(agent, rp);
		let thrown = (await agent.attempt("/login", (ctx) => rp.authorize(ctx))) as Response;

		expect(Number(thrown.headers.get("Retry-After"))).toBeGreaterThan(0);
		expect(thrown.headers.get("RateLimit")).toMatch(/limit=1/);
		expect(thrown.headers.get("RateLimit-Policy")).toBe("1;w=60");
		expect(await thrown.text()).not.toBe("");
	});

	test("asks the issuer for nothing once the browser's budget is spent", async () => {
		let agent = createAgent(CLIENT_IP);
		let discovery = stubDiscovery();
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });

		await startLogin(agent, createDiscoveringRelyingParty({ rateLimit }));
		expect(discovery.count).toBe(1);

		let cold = createDiscoveringRelyingParty({ rateLimit });
		let thrown = await agent.attempt("/login", (ctx) => cold.authorize(ctx));

		expect((thrown as Response).status).toBe(429);
		expect(discovery.count).toBe(1);
	});

	test("leaves the session as it was once the browser's budget is spent", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 1, window: "1 minute" }) });

		await startLogin(agent, rp);
		let started = await agent.run("/probe", async (ctx) =>
			ctx.get(Session)?.get(TRANSACTION_SESSION_KEY),
		);

		await agent.attempt("/login", (ctx) => rp.authorize(ctx));

		expect(
			await agent.run("/probe", async (ctx) => ctx.get(Session)?.get(TRANSACTION_SESSION_KEY)),
		).toEqual(started);
	});

	test("counts each client IP against a budget of its own", async () => {
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });
		let rp = createRelyingParty({ rateLimit });
		let spent = createAgent(CLIENT_IP);
		let fresh = createAgent("198.51.100.7");

		await startLogin(spent, rp);

		let refused = await spent.attempt("/login", (ctx) => rp.authorize(ctx));
		let allowed = await startLogin(fresh, rp);

		expect((refused as Response).status).toBe(429);
		expect(allowed.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
	});

	test("gathers every attempt the edge reports no IP for into one budget", async () => {
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });
		let rp = createRelyingParty({ rateLimit });

		await startLogin(createAgent(), rp);

		let thrown = await createAgent().attempt("/login", (ctx) => rp.authorize(ctx));

		expect((thrown as Response).status).toBe(429);
	});

	test("answers a refused login with a 429 the browser actually receives", async () => {
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 1, window: "1 minute" }) });
		let visit = createLoginApp(rp);

		expect((await visit(CLIENT_IP)).status).toBe(303);

		let refused = await visit(CLIENT_IP);

		expect(refused.status).toBe(429);
		expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
	});

	test("starts a login while the limiter cannot answer, so an outage signs people in", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty({ rateLimit: new UnreachableAdapter() });

		let params = await startLogin(agent, rp);

		expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
	});

	test("counts nothing when the client configures no budget", async () => {
		let agent = createAgent(CLIENT_IP);
		let rp = createRelyingParty();

		for (let attempt = 0; attempt < 5; attempt++) {
			let params = await startLogin(agent, rp);
			expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		}
	});
});

describe("endSession", () => {
	/** Signs a request in so a logout has something to end. */
	async function signIn(agent: Agent): Promise<string> {
		let idToken = await signIdToken({ sid: "session-1" });
		await agent.run("/probe", async (ctx) =>
			AuthSession.write(ctx, {
				idToken,
				accessToken: await signAccessToken(),
				refreshToken: "refresh-1",
				expiresAt: Math.floor(Date.now() / 1000) + ONE_HOUR,
			}),
		);
		return idToken;
	}

	test("sends the browser on with a 303, so a form post is followed by a GET", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await signIn(agent);

		let response = await agent.run("/logout", (ctx) => rp.endSession(ctx));

		expect(response.status).toBe(303);
	});

	test("redirects to the end-session endpoint with the ID token as the hint", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		let idToken = await signIn(agent);

		let response = await agent.run("/logout", (ctx) => rp.endSession(ctx, { returnTo: "/bye" }));
		let url = new URL(response.headers.get("location") ?? "", ISSUER);

		expect(response.status).toBe(303);
		expect(url.origin + url.pathname).toBe(END_SESSION_ENDPOINT);
		expect(url.searchParams.get("id_token_hint")).toBe(idToken);
		expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
		expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${APP_ORIGIN}/bye`);
	});

	test("signs the request out", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await signIn(agent);

		await agent.run("/logout", (ctx) => rp.endSession(ctx));

		expect(await agent.run("/probe", async (ctx) => AuthSession.from(ctx))).toBeNull();
	});

	test("answers with the URL when the caller sends the browser itself", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await signIn(agent);

		let url = await agent.run("/logout", (ctx) =>
			rp.endSession(ctx, { returnTo: "/bye", redirect: false }),
		);

		expect(url).toBeInstanceOf(URL);
		expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${APP_ORIGIN}/bye`);
	});

	test("holds post_logout_redirect_uri to this app's own origin", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();
		await signIn(agent);

		let url = await agent.run("/logout", (ctx) =>
			rp.endSession(ctx, { returnTo: "//evil.com", redirect: false }),
		);

		expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${APP_ORIGIN}/`);
	});

	test("ends a session nobody was signed in on", async () => {
		let agent = createAgent();
		let rp = createRelyingParty();

		let url = await agent.run("/logout", (ctx) => rp.endSession(ctx, { redirect: false }));

		expect(url.searchParams.get("id_token_hint")).toBeNull();
	});

	test("throws endpoint_unsupported when the issuer publishes no end-session endpoint", async () => {
		let agent = createAgent();
		let rp = createRelyingParty({}, { end_session_endpoint: undefined });

		let error = await agent.attempt("/logout", (ctx) => rp.endSession(ctx));

		expect(AuthError.is(error, AuthErrorCode.EndpointUnsupported)).toBe(true);
	});
});

describe("verifyIdToken", () => {
	test("accepts a token signed by the issuer for this client", async () => {
		let rp = createRelyingParty();

		let idToken = await rp.verifyIdToken(await signIdToken({ email: "ada@example.com" }));

		expect(idToken.subject).toBe("user-1");
		expect(idToken.email).toBe("ada@example.com");
	});

	test("rejects a token signed by another key", async () => {
		let rp = createRelyingParty();

		let error = await rp.verifyIdToken(await signIdToken({}, otherKeys)).catch((thrown) => thrown);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("rejects a token issued for another client", async () => {
		let rp = createRelyingParty();

		let error = await rp
			.verifyIdToken(await signIdToken({ aud: "another-client" }))
			.catch((thrown) => thrown);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("rejects a token issued by another issuer", async () => {
		let rp = createRelyingParty();

		let error = await rp
			.verifyIdToken(await signIdToken({ iss: "https://elsewhere.example.com" }))
			.catch((thrown) => thrown);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});

	test("accepts a token with no nonce, which the redirect flow supplies", async () => {
		let rp = createRelyingParty();

		let idToken = await rp.verifyIdToken(await signIdToken());

		expect(idToken.nonce).toBeNull();
	});
});

describe("exchangeRefreshToken", () => {
	test("presents the refresh token and answers with the renewed set", async () => {
		let rp = createRelyingParty();
		let request = stubTokenEndpoint(async () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: await signAccessToken({ scope: "openid monitors:write" }),
				refresh_token: "refresh-2",
				expires_in: ONE_HOUR,
			}),
		);

		let refreshed = await rp.exchangeRefreshToken("refresh-1");

		expect(request.body?.get("grant_type")).toBe("refresh_token");
		expect(request.body?.get("refresh_token")).toBe("refresh-1");
		expect(refreshed.refreshToken).toBe("refresh-2");
		expect(refreshed.idToken).toBeNull();
		expect(refreshed.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	test("verifies a reissued ID token before handing it back", async () => {
		let rp = createRelyingParty();
		stubTokenEndpoint(async () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: await signAccessToken(),
				id_token: await signIdToken({}, otherKeys),
			}),
		);

		let error = await rp.exchangeRefreshToken("refresh-1").catch((thrown) => thrown);

		expect(AuthError.is(error, AuthErrorCode.InvalidToken)).toBe(true);
	});
});
describe("scheme", () => {
	/**
	 * A token set the scheme finds in the session, with the expiry a test dictates on
	 * both the stored record and the access token's own `exp`, which is the claim the
	 * session reads first.
	 *
	 * @param expiresAt - Seconds since the epoch the set lapses at.
	 */
	async function storedTokens(expiresAt: number): Promise<AuthSession.Tokens> {
		return {
			idToken: await signIdToken(),
			accessToken: await signAccessToken({ exp: expiresAt }),
			refreshToken: "refresh-1",
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
	 * Runs one request through the real session and auth middlewares, seeding the
	 * session in a middleware ahead of `auth()` so the scheme reads it the way it
	 * does in production.
	 *
	 * @param scheme - The scheme under test.
	 * @param tokens - The token set to seed, or `null` for a signed-out request.
	 */
	async function resolve(
		scheme: AuthScheme<unknown>,
		tokens: AuthSession.Tokens | null,
	): Promise<Resolved> {
		let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
		let router = createRouter({
			middleware: [
				session(cookie, createMemorySessionStorage()),
				/**
				 * Seeds the session before identity is resolved.
				 *
				 * @param ctx - The request context the session middleware wrote to.
				 * @param next - The rest of the chain, `auth()` included.
				 */
				(ctx, next) => {
					if (tokens) AuthSession.write(ctx, tokens);
					return next();
				},
				auth({ schemes: [scheme] }),
			],
		});

		router.get("/probe", (ctx) =>
			Response.json({ auth: ctx.auth, signedIn: AuthSession.from(ctx) !== null }),
		);

		let response = await router.fetch(new Request(`${APP_ORIGIN}/probe`));
		return response.json() as Promise<Resolved>;
	}

	test("skips a request nobody is signed in on", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ verify: (session) => ({ id: session.idToken.subject }) });

		let resolved = await resolve(scheme, null);

		expect(resolved.auth).toEqual({ ok: false });
	});

	test("resolves the app's identity from a live session", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ verify: (session) => ({ id: session.idToken.subject }) });

		let resolved = await resolve(
			scheme,
			await storedTokens(Math.floor(Date.now() / 1000) + ONE_HOUR),
		);

		expect(resolved.auth).toEqual({
			ok: true,
			identity: { id: "user-1" },
			method: "oidc-session",
		});
	});

	test("reports the name the scheme was given", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ name: "sso", verify: () => ({ id: "user-1" }) });

		let resolved = await resolve(
			scheme,
			await storedTokens(Math.floor(Date.now() / 1000) + ONE_HOUR),
		);

		expect(resolved.auth).toMatchObject({ ok: true, method: "sso" });
	});

	test("renews an access token that has reached its expiry", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ verify: (session) => ({ scopes: session.accessToken.scopes }) });

		stubTokenEndpoint(async () =>
			HttpResponse.json({
				token_type: "Bearer",
				access_token: await signAccessToken({ scope: "openid monitors:write" }),
				expires_in: ONE_HOUR,
			}),
		);

		let resolved = await resolve(scheme, await storedTokens(Math.floor(Date.now() / 1000) - 1));

		expect(resolved.auth).toEqual({
			ok: true,
			identity: { scopes: ["openid", "monitors:write"] },
			method: "oidc-session",
		});
	});

	test("signs the request out when the renewal is refused", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ verify: (session) => ({ id: session.idToken.subject }) });

		stubTokenEndpoint(() => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }));

		let resolved = await resolve(scheme, await storedTokens(Math.floor(Date.now() / 1000) - 1));

		expect(resolved.auth).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
		expect(resolved.signedIn).toBe(false);
	});

	test("fails the request when the subject resolves to no identity", async () => {
		let rp = createRelyingParty();
		let scheme = rp.scheme({ verify: () => null });

		let resolved = await resolve(
			scheme,
			await storedTokens(Math.floor(Date.now() / 1000) + ONE_HOUR),
		);

		expect(resolved.auth).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});
});
