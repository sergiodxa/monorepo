/**
 * Covers what a `ResourceServer` promises each of its callers: the middleware, where a
 * request with no bearer credential is left for the next scheme, and an app calling it
 * directly, where a declined credential is named. Tokens are signed for real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JWT } from "@sdxc/jwt";
import type { AuthScheme } from "remix/middleware/auth";

import { JWK } from "@sdxc/jwt";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { Auth, auth } from "remix/middleware/auth";
import { RequestContext } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { AccessToken } from "./access-token.js";
import { AuthError } from "./auth-error.js";
import { Issuer } from "./issuer.js";
import { ResourceServer } from "./resource-server.js";

/** The issuer every test in this file is pointed at. */
const ISSUER = "https://auth.test";

/** Where OpenID Connect Discovery says the document for {@link ISSUER} lives. */
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

/** Where the document in this file says the key set is published. */
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

/** Where the document in this file says an opaque token is described. */
const INTROSPECTION_URL = `${ISSUER}/oauth/introspect`;

/** The client id this provider writes into an authorization-code token's `aud`. */
const CLIENT_ID = "client-1";

/** The resource indicator a client-credentials token requests and carries. */
const RESOURCE = "https://api.test";

/** Milliseconds in a second, for the epoch claims a token and an answer carry. */
const MS_PER_SECOND = 1000;

let server = setupServer();

/** The keys the issuer publishes, generated once for the whole file. */
let signing: JWK.KeyPair[];

/** A key pair the issuer never publishes, for tokens signed elsewhere. */
let foreign: JWK.KeyPair[];

/** Every token the introspection path asked about, in order. */
let introspections: string[] = [];

/**
 * Reads a value the wire writes as one item or as a list into a list either way.
 *
 * @param value - The member as the response carried it.
 */
function list(value: string | string[] | undefined): string[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * An introspector that reaches the issuer's endpoint over HTTP and reports the answer
 * in the shape a `ResourceServer` reads it in.
 */
const INTROSPECTOR: ResourceServer.Introspector = {
	/**
	 * Asks the issuer about a token, recording the question so a test can assert the
	 * endpoint was reached — or that it was left alone.
	 *
	 * @param token - The credential as presented.
	 */
	async introspect(token: string) {
		introspections.push(token);

		let response = await fetch(INTROSPECTION_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ token }),
		});

		let body = (await response.json()) as {
			active: boolean;
			sub?: string;
			client_id?: string;
			scope?: string;
			aud?: string | string[];
			iss?: string;
			exp?: number;
		};

		return {
			active: body.active,
			subject: body.sub ?? null,
			clientId: body.client_id ?? null,
			scopes: body.scope ? body.scope.split(" ") : [],
			audience: list(body.aud),
			issuer: body.iss ?? null,
			expiresAt: body.exp === undefined ? null : new Date(body.exp * MS_PER_SECOND),
		};
	},
};

beforeAll(async () => {
	signing = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	foreign = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];

	server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
	introspections = [];

	server.use(
		http.get(DISCOVERY_URL, () =>
			HttpResponse.json({
				issuer: ISSUER,
				authorization_endpoint: `${ISSUER}/oauth/authorize`,
				token_endpoint: `${ISSUER}/oauth/token`,
				introspection_endpoint: INTROSPECTION_URL,
				jwks_uri: JWKS_URL,
			}),
		),
		http.get(JWKS_URL, () => HttpResponse.json(JWK.toJSON(signing))),
	);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/**
 * A resource server over a fresh `Issuer`, so each test reads the published key set for
 * itself.
 *
 * @param options - Configuration to add or replace.
 */
function resourceServer(options: Partial<ResourceServer.Options> = {}): ResourceServer {
	return new ResourceServer(new Issuer(ISSUER), { audience: CLIENT_ID, ...options });
}

/**
 * Signs an access token, with the claims this provider always sends merged under the
 * ones a test is about.
 *
 * @param claims - Claims to add or replace.
 * @param keys - The keys to sign with.
 */
function sign(claims: JWT.PayloadInput = {}, keys: JWK.KeyPair[] = signing): Promise<string> {
	return new AccessToken({
		iss: ISSUER,
		sub: "user-123",
		aud: CLIENT_ID,
		client_id: CLIENT_ID,
		scope: "monitors:read monitors:write",
		iat: "0s",
		exp: "1h",
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);
}

/**
 * Runs a scheme through `auth()` against a request carrying the given header, and
 * reports the auth state a route would read.
 *
 * @param scheme - The scheme under test.
 * @param authorization - The header value, omitted for a request carrying none.
 */
async function resolve<identity>(scheme: AuthScheme<identity>, authorization?: string) {
	let headers: Record<string, string> = {};
	if (authorization !== undefined) headers.authorization = authorization;

	let context = new RequestContext(new Request(`${RESOURCE}/monitors`, { headers }));

	await auth({ schemes: [scheme] })(context, () => Promise.resolve(new Response("ok")));

	return context.get(Auth);
}

describe("scheme", () => {
	test("resolves a bearer token the issuer stands behind into an identity", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => ({ clientId: token.clientId }) });

		expect(await resolve(scheme, `Bearer ${await sign()}`)).toEqual({
			ok: true,
			identity: { clientId: CLIENT_ID },
			method: "bearer",
		});
	});

	test("reports the method name it was given", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ name: "api", verify: (token) => token.subject });

		expect(await resolve(scheme, `Bearer ${await sign()}`)).toEqual({
			ok: true,
			identity: "user-123",
			method: "api",
		});
	});

	test("leaves a request carrying no `Authorization` header anonymous", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme)).toEqual({ ok: false });
	});

	test("leaves a credential for another authentication scheme anonymous", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, `Basic ${btoa("user:password")}`)).toEqual({ ok: false });
	});

	test("leaves a header holding no credential anonymous", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer")).toEqual({ ok: false });
		expect(await resolve(scheme, "Bearer   ")).toEqual({ ok: false });
	});

	test("reports a token signed by a key the issuer does not publish as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, `Bearer ${await sign({}, foreign)}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials", method: "bearer", challenge: expect.any(String) },
		});
	});

	test("reports an expired token as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });
		let expired = await sign({
			iat: Math.floor(Date.now() / MS_PER_SECOND) - 7200,
			exp: Math.floor(Date.now() / MS_PER_SECOND) - 3600,
		});

		expect(await resolve(scheme, `Bearer ${expired}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("reports a token issued for another audience as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, `Bearer ${await sign({ aud: "another-client" })}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("reports a token naming another issuer as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(
			await resolve(scheme, `Bearer ${await sign({ iss: "https://elsewhere.test" })}`),
		).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
	});

	test("reports a caller the app declines as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: () => null });

		expect(await resolve(scheme, `Bearer ${await sign()}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("reports a credential that is neither a JWT nor introspectable as a failure", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer opaque-token")).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});
});

describe("audience", () => {
	test("accepts an `aud` the provider writes as a single value", async () => {
		let api = resourceServer({ audience: CLIENT_ID });
		let scheme = api.scheme({ verify: (token) => token.audience });

		expect(await resolve(scheme, `Bearer ${await sign({ aud: CLIENT_ID })}`)).toEqual({
			ok: true,
			identity: CLIENT_ID,
			method: "bearer",
		});
	});

	test("accepts an `aud` the provider writes as a list", async () => {
		let api = resourceServer({ audience: RESOURCE });
		let scheme = api.scheme({ verify: (token) => token.audience });

		let token = await sign({ aud: [ISSUER, RESOURCE] });

		expect(await resolve(scheme, `Bearer ${token}`)).toEqual({
			ok: true,
			identity: [ISSUER, RESOURCE],
			method: "bearer",
		});
	});

	test("accepts a token carrying any one of several configured audiences", async () => {
		let api = resourceServer({ audience: [CLIENT_ID, RESOURCE] });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, `Bearer ${await sign({ aud: CLIENT_ID })}`)).toMatchObject({
			ok: true,
		});
		expect(
			await resolve(scheme, `Bearer ${await sign({ aud: [ISSUER, RESOURCE] })}`),
		).toMatchObject({ ok: true });
	});

	test("reports a token carrying none of the configured audiences as a failure", async () => {
		let api = resourceServer({ audience: [CLIENT_ID, RESOURCE] });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(
			await resolve(scheme, `Bearer ${await sign({ aud: [ISSUER, "https://other.test"] })}`),
		).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
	});
});

describe("service callers", () => {
	test("hands over a client-credentials token whose `sub` names its own client", async () => {
		let api = resourceServer({ audience: RESOURCE });
		let scheme = api.scheme({
			verify: (token) => ({
				service: token.subject === token.clientId,
				clientId: token.clientId,
			}),
		});

		let token = await sign({
			sub: CLIENT_ID,
			client_id: CLIENT_ID,
			aud: [ISSUER, RESOURCE],
			scope: "monitors:read",
		});

		expect(await resolve(scheme, `Bearer ${token}`)).toEqual({
			ok: true,
			identity: { service: true, clientId: CLIENT_ID },
			method: "bearer",
		});
	});

	test("hands over an authorization-code token whose `sub` names a person", async () => {
		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject === token.clientId });

		expect(await resolve(scheme, `Bearer ${await sign()}`)).toEqual({
			ok: true,
			identity: false,
			method: "bearer",
		});
	});
});

describe("scopes", () => {
	test("hands `verify` the granted scopes and the question a route asks of them", async () => {
		let api = resourceServer();
		let scheme = api.scheme({
			verify: (token) => ({ scopes: token.scopes, write: token.has("monitors:write") }),
		});

		expect(await resolve(scheme, `Bearer ${await sign()}`)).toEqual({
			ok: true,
			identity: { scopes: ["monitors:read", "monitors:write"], write: true },
			method: "bearer",
		});
	});
});

describe("introspection", () => {
	test("resolves an opaque token the issuer reports active", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({
					active: true,
					sub: CLIENT_ID,
					client_id: CLIENT_ID,
					scope: "monitors:read",
					aud: [ISSUER, RESOURCE],
					iss: ISSUER,
					exp: Math.floor(Date.now() / MS_PER_SECOND) + 3600,
				}),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });
		let scheme = api.scheme({
			verify: (token) => ({ clientId: token.clientId, read: token.has("monitors:read") }),
		});

		expect(await resolve(scheme, "Bearer opaque-token")).toEqual({
			ok: true,
			identity: { clientId: CLIENT_ID, read: true },
			method: "bearer",
		});
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("reports an opaque token the issuer reports inactive as a failure", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: false })));

		let api = resourceServer({ introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer opaque-token")).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("reports an active token described for another audience as a failure", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({ active: true, sub: CLIENT_ID, aud: "https://other.test" }),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer opaque-token")).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("reports an active token described by another issuer as a failure", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({
					active: true,
					sub: CLIENT_ID,
					aud: CLIENT_ID,
					iss: "https://elsewhere.test",
				}),
			),
		);

		let api = resourceServer({ introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer opaque-token")).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
	});

	test("reports an active token described with no audience as a failure", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({ active: true, sub: CLIENT_ID, client_id: CLIENT_ID, iss: ISSUER }),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, "Bearer opaque-token")).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("resolves an active token described with no audience where that is accepted", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({ active: true, sub: CLIENT_ID, client_id: CLIENT_ID, iss: ISSUER }),
			),
		);

		let api = resourceServer({
			audience: RESOURCE,
			introspection: INTROSPECTOR,
			acceptUnscopedIntrospection: true,
		});
		let scheme = api.scheme({ verify: (token) => ({ clientId: token.clientId }) });

		expect(await resolve(scheme, "Bearer opaque-token")).toEqual({
			ok: true,
			identity: { clientId: CLIENT_ID },
			method: "bearer",
		});
	});

	test("keeps a JWT the key set rejects away from the introspection endpoint", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: true })));

		let api = resourceServer({ introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });

		expect(await resolve(scheme, `Bearer ${await sign({}, foreign)}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
		expect(introspections).toEqual([]);
	});

	test("keeps an expired JWT away from the introspection endpoint", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: true })));

		let api = resourceServer({ introspection: INTROSPECTOR });
		let scheme = api.scheme({ verify: (token) => token.subject });
		let expired = await sign({
			iat: Math.floor(Date.now() / MS_PER_SECOND) - 7200,
			exp: Math.floor(Date.now() / MS_PER_SECOND) - 3600,
		});

		expect(await resolve(scheme, `Bearer ${expired}`)).toMatchObject({
			ok: false,
			error: { code: "invalid_credentials" },
		});
		expect(introspections).toEqual([]);
	});
});

describe("verifyAccessToken", () => {
	test("hands back the token behind a JWT the issuer stands behind", async () => {
		let api = resourceServer();
		let token = await api.verifyAccessToken(await sign());

		expect(token).toBeInstanceOf(AccessToken);
		expect(token.subject).toBe("user-123");
		expect(token.clientId).toBe(CLIENT_ID);
		expect(token.scopes).toEqual(["monitors:read", "monitors:write"]);
	});

	test("names a token signed by a key the issuer does not publish", async () => {
		let api = resourceServer();
		let credential = await sign({}, foreign);

		await expect(api.verifyAccessToken(credential)).rejects.toMatchObject({
			name: "AuthError",
			code: "invalid_token",
		});
	});

	test("names an expired token", async () => {
		let api = resourceServer();
		let expired = await sign({
			iat: Math.floor(Date.now() / MS_PER_SECOND) - 7200,
			exp: Math.floor(Date.now() / MS_PER_SECOND) - 3600,
		});

		await expect(api.verifyAccessToken(expired)).rejects.toMatchObject({
			name: "AuthError",
			code: "invalid_token",
		});
	});

	test("names a token issued for another audience", async () => {
		let api = resourceServer();
		let credential = await sign({ aud: "another-client" });

		await expect(api.verifyAccessToken(credential)).rejects.toMatchObject({
			name: "AuthError",
			code: "invalid_token",
		});
	});

	test("hands back the token behind an opaque credential the issuer reports active", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({
					active: true,
					sub: CLIENT_ID,
					client_id: CLIENT_ID,
					scope: "monitors:read",
					aud: [ISSUER, RESOURCE],
					iss: ISSUER,
					exp: Math.floor(Date.now() / MS_PER_SECOND) + 3600,
				}),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });
		let token = await api.verifyAccessToken("opaque-token");

		expect(token.clientId).toBe(CLIENT_ID);
		expect(token.has("monitors:read")).toBe(true);
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("names an opaque credential the issuer reports inactive", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: false })));

		let api = resourceServer({ introspection: INTROSPECTOR });

		await expect(api.verifyAccessToken("opaque-token")).rejects.toMatchObject({
			name: "AuthError",
			code: "invalid_token",
		});
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("reports an issuer that cannot publish its key set as the outage it is", async () => {
		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 500 })));

		let api = resourceServer();
		let credential = await sign();

		await expect(api.verifyAccessToken(credential)).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, "jwks_failed"),
		);
	});

	test("reports a key set gone unreachable during a refetch as the outage it is", async () => {
		let reads = 0;

		server.use(
			http.get(JWKS_URL, () => {
				reads += 1;
				if (reads === 1) return HttpResponse.json(JWK.toJSON(signing));
				return new HttpResponse(null, { status: 500 });
			}),
		);

		let api = resourceServer();
		let credential = await sign({}, foreign);

		await expect(api.verifyAccessToken(credential)).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, "jwks_failed"),
		);
	});

	test("reports an issuer that cannot publish its document as the outage it is", async () => {
		server.use(http.get(DISCOVERY_URL, () => new HttpResponse(null, { status: 503 })));

		let api = resourceServer();
		let credential = await sign();

		await expect(api.verifyAccessToken(credential)).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, "discovery_failed"),
		);
	});
});

describe("infrastructure failures", () => {
	test("lets an unreadable key set out of the scheme instead of refusing the caller", async () => {
		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 500 })));

		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		await expect(resolve(scheme, `Bearer ${await sign()}`)).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, "jwks_failed"),
		);
	});

	test("lets an unreadable discovery document out of the scheme", async () => {
		server.use(http.get(DISCOVERY_URL, () => new HttpResponse(null, { status: 503 })));

		let api = resourceServer();
		let scheme = api.scheme({ verify: (token) => token.subject });

		await expect(resolve(scheme, `Bearer ${await sign()}`)).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, "discovery_failed"),
		);
	});
});
