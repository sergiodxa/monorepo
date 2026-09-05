/**
 * Covers what a `ResourceServer` promises each of its callers: a request, where one
 * carrying no bearer credential is told apart from one the server declines, and an app
 * holding the bare credential, where a declined one is named. Tokens are signed for real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JWT } from "@sdxc/jwt";

import { JWK } from "@sdxc/jwt";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
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
 * The request a caller makes, carrying the given `Authorization` header.
 *
 * @param authorization - The header value, omitted for a request carrying none.
 */
function request(authorization?: string): Request {
	let headers: Record<string, string> = {};
	if (authorization !== undefined) headers.authorization = authorization;
	return new Request(`${RESOURCE}/monitors`, { headers });
}

/** The refusal every credential this server declines is named with. */
const INVALID_TOKEN = { name: "AuthError", code: "invalid_token" };

describe("issuer", () => {
	test("hands out the provider whose tokens it accepts", () => {
		let issuer = new Issuer(ISSUER);
		let server = new ResourceServer(issuer, { audience: CLIENT_ID });

		expect(server.issuer).toBe(issuer);
	});
});

describe("verifyRequest", () => {
	test("hands back the token behind a bearer credential the issuer stands behind", async () => {
		let api = resourceServer();

		let token = await api.verifyRequest(request(`Bearer ${await sign()}`));

		expect(token).toBeInstanceOf(AccessToken);
		expect(token?.subject).toBe("user-123");
		expect(token?.clientId).toBe(CLIENT_ID);
	});

	test("answers null for a request carrying no `Authorization` header", async () => {
		let api = resourceServer();

		expect(await api.verifyRequest(request())).toBeNull();
	});

	test("answers null for a credential under another authentication method", async () => {
		let api = resourceServer();

		expect(await api.verifyRequest(request(`Basic ${btoa("user:password")}`))).toBeNull();
	});

	test("answers null for a header holding no credential", async () => {
		let api = resourceServer();

		expect(await api.verifyRequest(request("Bearer"))).toBeNull();
		expect(await api.verifyRequest(request("Bearer   "))).toBeNull();
	});

	test("names a token signed by a key the issuer does not publish", async () => {
		let api = resourceServer();

		await expect(
			api.verifyRequest(request(`Bearer ${await sign({}, foreign)}`)),
		).rejects.toMatchObject(INVALID_TOKEN);
	});

	test("names an expired token", async () => {
		let api = resourceServer();
		let expired = await sign({
			iat: Math.floor(Date.now() / MS_PER_SECOND) - 7200,
			exp: Math.floor(Date.now() / MS_PER_SECOND) - 3600,
		});

		await expect(api.verifyRequest(request(`Bearer ${expired}`))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
	});

	test("names a token issued for another audience", async () => {
		let api = resourceServer();

		await expect(
			api.verifyRequest(request(`Bearer ${await sign({ aud: "another-client" })}`)),
		).rejects.toMatchObject(INVALID_TOKEN);
	});

	test("names a token naming another issuer", async () => {
		let api = resourceServer();

		await expect(
			api.verifyRequest(request(`Bearer ${await sign({ iss: "https://elsewhere.test" })}`)),
		).rejects.toMatchObject(INVALID_TOKEN);
	});

	test("names a credential that is neither a JWT nor introspectable", async () => {
		let api = resourceServer();

		await expect(api.verifyRequest(request("Bearer opaque-token"))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
	});
});

describe("audience", () => {
	test("accepts an `aud` the provider writes as a single value", async () => {
		let api = resourceServer({ audience: CLIENT_ID });

		let token = await api.verifyRequest(request(`Bearer ${await sign({ aud: CLIENT_ID })}`));

		expect(token?.audience).toBe(CLIENT_ID);
	});

	test("accepts an `aud` the provider writes as a list", async () => {
		let api = resourceServer({ audience: RESOURCE });

		let token = await api.verifyRequest(
			request(`Bearer ${await sign({ aud: [ISSUER, RESOURCE] })}`),
		);

		expect(token?.audience).toEqual([ISSUER, RESOURCE]);
	});

	test("accepts a token carrying any one of several configured audiences", async () => {
		let api = resourceServer({ audience: [CLIENT_ID, RESOURCE] });

		let person = await api.verifyRequest(request(`Bearer ${await sign({ aud: CLIENT_ID })}`));
		let service = await api.verifyRequest(
			request(`Bearer ${await sign({ aud: [ISSUER, RESOURCE] })}`),
		);

		expect(person).toBeInstanceOf(AccessToken);
		expect(service).toBeInstanceOf(AccessToken);
	});

	test("names a token carrying none of the configured audiences", async () => {
		let api = resourceServer({ audience: [CLIENT_ID, RESOURCE] });

		await expect(
			api.verifyRequest(request(`Bearer ${await sign({ aud: [ISSUER, "https://other.test"] })}`)),
		).rejects.toMatchObject(INVALID_TOKEN);
	});
});

describe("service callers", () => {
	test("hands over a client-credentials token whose `sub` names its own client", async () => {
		let api = resourceServer({ audience: RESOURCE });
		let credential = await sign({
			sub: CLIENT_ID,
			client_id: CLIENT_ID,
			aud: [ISSUER, RESOURCE],
			scope: "monitors:read",
		});

		let token = await api.verifyRequest(request(`Bearer ${credential}`));

		expect(token?.issuedToService).toBe(true);
		expect(token?.clientId).toBe(CLIENT_ID);
	});

	test("hands over an authorization-code token whose `sub` names a person", async () => {
		let api = resourceServer();

		let token = await api.verifyRequest(request(`Bearer ${await sign()}`));

		expect(token?.issuedToService).toBe(false);
	});
});

describe("scopes", () => {
	test("hands over the granted scopes and the question a route asks of them", async () => {
		let api = resourceServer();

		let token = await api.verifyRequest(request(`Bearer ${await sign()}`));

		expect(token?.scopes).toEqual(["monitors:read", "monitors:write"]);
		expect(token?.has("monitors:write")).toBe(true);
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

		let token = await api.verifyRequest(request("Bearer opaque-token"));

		expect(token?.clientId).toBe(CLIENT_ID);
		expect(token?.has("monitors:read")).toBe(true);
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("names an opaque token the issuer reports inactive", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: false })));

		let api = resourceServer({ introspection: INTROSPECTOR });

		await expect(api.verifyRequest(request("Bearer opaque-token"))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
		expect(introspections).toEqual(["opaque-token"]);
	});

	test("names an active token described for another audience", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({ active: true, sub: CLIENT_ID, aud: "https://other.test" }),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });

		await expect(api.verifyRequest(request("Bearer opaque-token"))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
	});

	test("names an active token described by another issuer", async () => {
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

		await expect(api.verifyRequest(request("Bearer opaque-token"))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
	});

	test("names an active token described with no audience", async () => {
		server.use(
			http.post(INTROSPECTION_URL, () =>
				HttpResponse.json({ active: true, sub: CLIENT_ID, client_id: CLIENT_ID, iss: ISSUER }),
			),
		);

		let api = resourceServer({ audience: RESOURCE, introspection: INTROSPECTOR });

		await expect(api.verifyRequest(request("Bearer opaque-token"))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
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

		let token = await api.verifyRequest(request("Bearer opaque-token"));

		expect(token?.clientId).toBe(CLIENT_ID);
	});

	test("keeps a JWT the key set rejects away from the introspection endpoint", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: true })));

		let api = resourceServer({ introspection: INTROSPECTOR });

		await expect(
			api.verifyRequest(request(`Bearer ${await sign({}, foreign)}`)),
		).rejects.toMatchObject(INVALID_TOKEN);
		expect(introspections).toEqual([]);
	});

	test("keeps an expired JWT away from the introspection endpoint", async () => {
		server.use(http.post(INTROSPECTION_URL, () => HttpResponse.json({ active: true })));

		let api = resourceServer({ introspection: INTROSPECTOR });
		let expired = await sign({
			iat: Math.floor(Date.now() / MS_PER_SECOND) - 7200,
			exp: Math.floor(Date.now() / MS_PER_SECOND) - 3600,
		});

		await expect(api.verifyRequest(request(`Bearer ${expired}`))).rejects.toMatchObject(
			INVALID_TOKEN,
		);
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
	test("reports an unreadable key set as the outage it is instead of refusing the caller", async () => {
		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 500 })));

		let api = resourceServer();

		await expect(api.verifyRequest(request(`Bearer ${await sign()}`))).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, "jwks_failed"),
		);
	});

	test("reports an unreadable discovery document as the outage it is", async () => {
		server.use(http.get(DISCOVERY_URL, () => new HttpResponse(null, { status: 503 })));

		let api = resourceServer();

		await expect(api.verifyRequest(request(`Bearer ${await sign()}`))).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, "discovery_failed"),
		);
	});
});
