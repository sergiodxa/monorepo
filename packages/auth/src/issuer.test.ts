/**
 * Covers what an `Issuer` promises its callers: a validated discovery document held to
 * the issuer it was asked for, a named error for every way discovery and the key set can
 * fail, a verified ID token, and one instance and one fetch per configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/kv-cache";

import { JWK, JWT } from "@sdxc/jwt";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { AuthError, AuthErrorCode } from "./auth-error";
import { Issuer } from "./issuer";

/** The issuer every test in this file is pointed at. */
const ISSUER = "https://auth.test";

/** Where OpenID Connect Discovery says the document for {@link ISSUER} lives. */
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

/** Where the documents in this file say the key set is published. */
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

/**
 * The identifier a provider publishes without a scheme, standing in for one whose
 * `iss` is a bare host.
 */
const SCHEMELESS_ISSUER = "auth.test";

/** Pinned so a token claiming another algorithm fails. */
const VERIFY = { algorithms: [JWK.Algorithm.ES256] };

/** The client every ID token in this file is issued to. */
const AUDIENCE = "dashboard";

let server = setupServer();

/** How many requests each URL has received since the current test began. */
let requests = new Map<string, number>();

/**
 * A cache whose entries outlive the `Issuer` that wrote them, standing in for the
 * tier several isolates share.
 */
class MemoryCacheStore implements Issuer.CacheStore {
	/** Everything written so far, so a test can inspect what was shared. */
	readonly entries = new Map<string, string>();

	/**
	 * Reads an entry.
	 *
	 * @param key - Entry to read.
	 * @returns The stored value, or `null` when nothing is stored there.
	 */
	read(key: string): Promise<string | null> {
		return Promise.resolve(this.entries.get(key) ?? null);
	}

	/**
	 * Stores an entry.
	 *
	 * @param key - Entry to write.
	 * @param value - Value to store.
	 */
	write(key: string, value: string): Promise<void> {
		this.entries.set(key, value);
		return Promise.resolve();
	}

	/**
	 * Returns the stored entry, computing and storing it on a miss.
	 *
	 * @param key - Entry to read.
	 * @param load - Computes the value when the entry is missing.
	 */
	async fetch(key: string, load: () => Promise<string>): Promise<string> {
		let cached = await this.read(key);
		if (cached !== null) return cached;

		let value = await load();
		await this.write(key, value);
		return value;
	}
}

/**
 * A discovery document naming {@link ISSUER}, with the members a test cares about
 * merged over the four every provider publishes.
 *
 * @param overrides - Members to add or replace.
 */
function document(overrides: Partial<Issuer.Metadata> = {}): Issuer.Metadata {
	return {
		issuer: ISSUER,
		authorization_endpoint: `${ISSUER}/oauth/authorize`,
		token_endpoint: `${ISSUER}/oauth/token`,
		jwks_uri: JWKS_URL,
		...overrides,
	};
}

/**
 * Answers requests to a URL with JSON, counting them so a test can assert how many
 * times the network was reached.
 *
 * @param url - URL to answer.
 * @param body - JSON body to answer with.
 * @param status - Status to answer with.
 */
function respond(url: string, body: Parameters<typeof HttpResponse.json>[0], status = 200): void {
	server.use(
		http.get(url, () => {
			requests.set(url, (requests.get(url) ?? 0) + 1);
			return HttpResponse.json(body, { status });
		}),
	);
}

/**
 * Answers requests to a URL with a body that is not JSON, counting them the same way
 * {@link respond} does.
 *
 * @param url - URL to answer.
 * @param body - Body to answer with.
 */
function respondText(url: string, body: string): void {
	server.use(
		http.get(url, () => {
			requests.set(url, (requests.get(url) ?? 0) + 1);
			return HttpResponse.text(body);
		}),
	);
}

/**
 * Answers requests to a URL with a body carried as a blob, so the answer declares
 * exactly the media type a test names and nothing when it names none.
 *
 * @param url - URL to answer.
 * @param body - Body to answer with.
 * @param contentType - The media type the provider declares, left off when absent.
 */
function respondAs(url: string, body: string, contentType?: string): void {
	server.use(
		http.get(url, () => {
			requests.set(url, (requests.get(url) ?? 0) + 1);
			let headers = contentType === undefined ? undefined : { "content-type": contentType };
			return new HttpResponse(new Blob([body]), { headers });
		}),
	);
}

/**
 * How many requests a URL has received in the current test.
 *
 * @param url - URL to report on.
 */
function count(url: string): number {
	return requests.get(url) ?? 0;
}

/** Origins handed out so far, so each test reads a provider no other test shares. */
let providers = 0;

/**
 * Serves a provider on an origin no earlier test asked for, so the instance registry
 * hands each test a memo of its own.
 *
 * @param pair - The key the provider publishes.
 * @returns The origin, and the two URLs its reads are counted under.
 */
function freshProvider(pair: JWK.KeyPair): { origin: string; discovery: string; jwks: string } {
	providers += 1;

	let origin = `https://issuer-${providers}.test`;
	let discovery = `${origin}/.well-known/openid-configuration`;
	let jwks = `${origin}/.well-known/jwks.json`;

	respond(discovery, {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		jwks_uri: jwks,
	});
	respond(jwks, JWK.toJSON([pair]));

	return { origin, discovery, jwks };
}

/**
 * Signs an ID token the way a provider does, letting a test override the claims that
 * make a fixture valid or invalid.
 *
 * @param origin - The issuer the token names.
 * @param pair - The key it is signed with.
 * @param claims - Claims layered over a well-formed token.
 * @param algorithm - The algorithm its header presents.
 */
function signIdToken(
	origin: string,
	pair: JWK.KeyPair,
	claims: Record<string, unknown> = {},
	algorithm: JWK.Algorithm = JWK.Algorithm.ES256,
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);

	return new JWT({
		iss: origin,
		aud: AUDIENCE,
		sub: "user-123",
		iat: now,
		nbf: now,
		exp: now + 300,
		...claims,
	}).sign(algorithm, [pair]);
}

/**
 * A fresh ES256 pair, imported and ready to sign with.
 */
async function keyPair(): Promise<JWK.KeyPair> {
	return await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => requests.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("metadata", () => {
	test("reads the document the issuer publishes", async () => {
		respond(
			DISCOVERY_URL,
			document({
				userinfo_endpoint: `${ISSUER}/oauth/userinfo`,
				end_session_endpoint: `${ISSUER}/oauth/logout`,
				revocation_endpoint: `${ISSUER}/oauth/revoke`,
				introspection_endpoint: `${ISSUER}/oauth/introspect`,
				scopes_supported: ["openid", "profile"],
				response_types_supported: ["code"],
				token_endpoint_auth_methods_supported: ["client_secret_post"],
				acr_values_supported: ["urn:passkey"],
				code_challenge_methods_supported: ["S256"],
			}),
		);

		let issuer = new Issuer(ISSUER);

		await expect(issuer.identifier()).resolves.toBe(ISSUER);
		await expect(issuer.authorizationEndpoint()).resolves.toEqual(
			new URL(`${ISSUER}/oauth/authorize`),
		);
		await expect(issuer.tokenEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/token`));
		await expect(issuer.jwksUri()).resolves.toEqual(new URL(JWKS_URL));
		await expect(issuer.userInfoEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/userinfo`));
		await expect(issuer.endSessionEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/logout`));
		await expect(issuer.revocationEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/revoke`));
		await expect(issuer.introspectionEndpoint()).resolves.toEqual(
			new URL(`${ISSUER}/oauth/introspect`),
		);
		await expect(issuer.scopesSupported()).resolves.toEqual(["openid", "profile"]);
		await expect(issuer.responseTypesSupported()).resolves.toEqual(["code"]);
		await expect(issuer.tokenEndpointAuthMethodsSupported()).resolves.toEqual([
			"client_secret_post",
		]);
		await expect(issuer.acrValuesSupported()).resolves.toEqual(["urn:passkey"]);
		await expect(issuer.codeChallengeMethodsSupported()).resolves.toEqual(["S256"]);
	});

	test("appends the well-known path to an identifier carrying a path", async () => {
		let tenant = `${ISSUER}/tenant-1`;
		respond(`${tenant}/.well-known/openid-configuration`, document({ issuer: tenant }));

		await expect(new Issuer(tenant).identifier()).resolves.toBe(tenant);
	});

	test("accepts a trailing slash on either side of the identity check", async () => {
		respond(DISCOVERY_URL, document({ issuer: `${ISSUER}/` }));

		await expect(new Issuer(`${ISSUER}/`).identifier()).resolves.toBe(`${ISSUER}/`);
	});

	test("accepts a host named in another case on either side of the identity check", async () => {
		respond(DISCOVERY_URL, document({ issuer: "https://AUTH.test" }));

		await expect(new Issuer(ISSUER).identifier()).resolves.toBe("https://AUTH.test");
	});

	test("reports an empty issuer as a discovery failure", async () => {
		respond(DISCOVERY_URL, document({ issuer: "" }));

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.DiscoveryFailed),
		);
	});

	test("refuses a document naming another issuer", async () => {
		respond(DISCOVERY_URL, document({ issuer: "https://evil.test" }));

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.IssuerMismatch),
		);
	});

	test("reports a refused request as a discovery failure", async () => {
		respond(DISCOVERY_URL, { error: "boom" }, 500);

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.DiscoveryFailed),
		);
	});

	test("reports a body that is not JSON as a discovery failure", async () => {
		respondText(DISCOVERY_URL, "<html>maintenance</html>");

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.DiscoveryFailed),
		);
	});

	test("reports a document declared as HTML as a discovery failure, naming the type", async () => {
		respondAs(DISCOVERY_URL, JSON.stringify(document()), "text/html");

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy(
			(error: unknown) =>
				AuthError.is(error, AuthErrorCode.DiscoveryFailed) && error.message.includes("text/html"),
		);
	});

	test("reads a document from an answer that declares no media type", async () => {
		respondAs(DISCOVERY_URL, JSON.stringify(document()));

		let metadata = await new Issuer(ISSUER).metadata();

		expect(metadata.issuer).toBe(ISSUER);
	});

	test("reports a document missing a required endpoint as a discovery failure", async () => {
		respond(DISCOVERY_URL, { issuer: ISSUER, authorization_endpoint: `${ISSUER}/oauth/authorize` });

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.DiscoveryFailed),
		);
	});

	test("reports an endpoint that is not a URL as a discovery failure", async () => {
		respond(DISCOVERY_URL, document({ token_endpoint: "not-a-url" }));

		await expect(new Issuer(ISSUER).metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.DiscoveryFailed),
		);
	});

	test("refuses an unadvertised endpoint by name", async () => {
		respond(DISCOVERY_URL, document());

		let issuer = new Issuer(ISSUER);

		await expect(issuer.userInfoEndpoint()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.EndpointUnsupported),
		);
		await expect(issuer.endSessionEndpoint()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.EndpointUnsupported),
		);
		await expect(issuer.revocationEndpoint()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.EndpointUnsupported),
		);
		await expect(issuer.introspectionEndpoint()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.EndpointUnsupported),
		);
	});

	test("answers an unadvertised list as empty", async () => {
		respond(DISCOVERY_URL, document());

		let issuer = new Issuer(ISSUER);

		await expect(issuer.scopesSupported()).resolves.toEqual([]);
		await expect(issuer.responseTypesSupported()).resolves.toEqual([]);
		await expect(issuer.tokenEndpointAuthMethodsSupported()).resolves.toEqual([]);
		await expect(issuer.acrValuesSupported()).resolves.toEqual([]);
		await expect(issuer.codeChallengeMethodsSupported()).resolves.toEqual([]);
	});

	test("serves configured metadata without reaching the network", async () => {
		respond(DISCOVERY_URL, document());

		let issuer = new Issuer(ISSUER, {
			metadata: document({ end_session_endpoint: `${ISSUER}/oauth/logout` }),
		});

		await expect(issuer.identifier()).resolves.toBe(ISSUER);
		await expect(issuer.endSessionEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/logout`));
		expect(count(DISCOVERY_URL)).toBe(0);
	});

	test("checks configured metadata against the issuer it is configured on", async () => {
		let issuer = new Issuer(ISSUER, { metadata: document({ issuer: "https://evil.test" }) });

		await expect(issuer.metadata()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.IssuerMismatch),
		);
	});
});

describe("an identifier stated apart from the URL", () => {
	test("verifies a token whose `iss` is the bare identifier the provider publishes", async () => {
		let pair = await keyPair();
		respond(DISCOVERY_URL, document({ issuer: SCHEMELESS_ISSUER }));
		respond(JWKS_URL, JWK.toJSON([pair]));

		let issuer = new Issuer(ISSUER, { identifier: SCHEMELESS_ISSUER });
		let signed = await new JWT({ sub: "user-123", iss: SCHEMELESS_ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[pair],
		);

		await expect(issuer.identifier()).resolves.toBe(SCHEMELESS_ISSUER);
		await expect(issuer.tokenEndpoint()).resolves.toEqual(new URL(`${ISSUER}/oauth/token`));

		let verified = await JWT.verify(signed, await issuer.keys(), {
			...VERIFY,
			issuer: await issuer.identifier(),
		});

		expect(verified.subject).toBe("user-123");
		expect(count(DISCOVERY_URL)).toBe(1);
		expect(count(JWKS_URL)).toBe(1);
	});

	test("checks configured metadata against the stated identifier", async () => {
		let issuer = new Issuer(ISSUER, {
			identifier: SCHEMELESS_ISSUER,
			metadata: document({ issuer: SCHEMELESS_ISSUER }),
		});

		await expect(issuer.identifier()).resolves.toBe(SCHEMELESS_ISSUER);
		expect(count(DISCOVERY_URL)).toBe(0);
	});

	test("refuses a document publishing the URL where a bare identifier was stated", async () => {
		respond(DISCOVERY_URL, document({ issuer: ISSUER }));

		await expect(
			new Issuer(ISSUER, { identifier: SCHEMELESS_ISSUER }).metadata(),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.IssuerMismatch));
	});

	test("refuses a document publishing another bare host", async () => {
		respond(DISCOVERY_URL, document({ issuer: "evil.test" }));

		await expect(
			new Issuer(ISSUER, { identifier: SCHEMELESS_ISSUER }).metadata(),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.IssuerMismatch));
	});

	test("refuses a bare identifier as the URL discovery is fetched from", () => {
		let build = () => new Issuer(SCHEMELESS_ISSUER);

		expect(build).toThrow(Error);
		expect(build).toThrow(/absolute URL/);
		expect(build).toThrow(/`identifier`/);
		expect(build).not.toThrow(AuthError);
	});
});

describe("keys", () => {
	test("verifies a token signed by a published key", async () => {
		let pair = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([pair]));

		let issuer = new Issuer(ISSUER);
		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[pair],
		);

		let verified = await JWT.verify(signed, await issuer.keys(), {
			...VERIFY,
			issuer: await issuer.identifier(),
		});

		expect(verified.subject).toBe("user-123");
	});

	test("refuses a token signed by a key the issuer does not publish", async () => {
		let published = await keyPair();
		let other = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([published]));

		let issuer = new Issuer(ISSUER);
		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[other],
		);

		await expect(JWT.verify(signed, await issuer.keys(), VERIFY)).rejects.toThrow();
	});

	test("reports a refused key set request as a JWKS failure", async () => {
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, { error: "boom" }, 500);

		await expect(new Issuer(ISSUER).keys()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});

	test("reports a body that is not JSON as a JWKS failure", async () => {
		respond(DISCOVERY_URL, document());
		respondText(JWKS_URL, "<html>maintenance</html>");

		await expect(new Issuer(ISSUER).keys()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});

	test("reports a set without a keys member as a JWKS failure", async () => {
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, { unexpected: true });

		await expect(new Issuer(ISSUER).keys()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});

	test("reports a set holding no key as a JWKS failure", async () => {
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, { keys: [] });

		await expect(new Issuer(ISSUER).keys()).rejects.toSatisfy((error: unknown) =>
			AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});
});
describe("a rotation the read key set predates", () => {
	test("verifies a token signed by a key published after the set was read", async () => {
		let retiring = await keyPair();
		let minted = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([retiring]));

		let issuer = new Issuer(ISSUER);
		let keys = await issuer.keys();

		respond(JWKS_URL, JWK.toJSON([minted, retiring]));

		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[minted],
		);

		let verified = await JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER });

		expect(verified.subject).toBe("user-123");
		expect(count(JWKS_URL)).toBe(2);

		let again = await JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER });

		expect(again.subject).toBe("user-123");
		expect(count(JWKS_URL)).toBe(2);
	});

	test("keeps verifying a token signed by the key the rotation retired", async () => {
		let retiring = await keyPair();
		let minted = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([retiring]));

		let issuer = new Issuer(ISSUER);
		let keys = await issuer.keys();

		respond(JWKS_URL, JWK.toJSON([minted, retiring]));

		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[retiring],
		);

		await expect(JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER })).resolves.toBeDefined();
		expect(count(JWKS_URL)).toBe(1);
	});

	test("refuses a token naming a key the provider publishes nowhere, after one refetch", async () => {
		let published = await keyPair();
		let foreign = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([published]));

		let issuer = new Issuer(ISSUER);
		let keys = await issuer.keys();

		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[foreign],
		);

		await expect(JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER })).rejects.toThrow();
		expect(count(JWKS_URL)).toBe(2);
	});

	test("spends one refetch on the burst of verifications a rotation fails at once", async () => {
		let retiring = await keyPair();
		let minted = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([retiring]));

		let issuer = new Issuer(ISSUER);
		let keys = await issuer.keys();

		respond(JWKS_URL, JWK.toJSON([minted, retiring]));

		let signed = await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				new JWT({ sub: `user-${index}`, iss: ISSUER, exp: "1h" }).sign(JWK.Algorithm.ES256, [
					minted,
				]),
			),
		);

		let verified = await Promise.all(
			signed.map((token) => JWT.verify(token, keys, { ...VERIFY, issuer: ISSUER })),
		);

		expect(verified.map((token) => token.subject)).toEqual([
			"user-0",
			"user-1",
			"user-2",
			"user-3",
			"user-4",
		]);
		expect(count(JWKS_URL)).toBe(2);
	});

	test("puts the refetched set in front of the store another isolate reads", async () => {
		let retiring = await keyPair();
		let minted = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([retiring]));

		let cache = new MemoryCacheStore();
		let warm = new Issuer(ISSUER, { cache });
		let keys = await warm.keys();

		respond(JWKS_URL, JWK.toJSON([minted, retiring]));

		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[minted],
		);

		await JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER });

		server.resetHandlers();

		let cold = new Issuer(ISSUER, { cache });
		let verified = await JWT.verify(signed, await cold.keys(), { ...VERIFY, issuer: ISSUER });

		expect(verified.subject).toBe("user-123");
		expect(count(JWKS_URL)).toBe(2);
	});

	test("reports an unreachable key set during a refetch as a JWKS failure", async () => {
		let published = await keyPair();
		let foreign = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([published]));

		let issuer = new Issuer(ISSUER);
		let keys = await issuer.keys();

		respond(JWKS_URL, { error: "boom" }, 500);

		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[foreign],
		);

		await expect(JWT.verify(signed, keys, { ...VERIFY, issuer: ISSUER })).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});

	test("holds an unreachable key set apart from a token that failed a check", async () => {
		let published = await keyPair();
		let foreign = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([published]));

		let issuer = new Issuer(ISSUER);
		await issuer.keys();

		respond(JWKS_URL, { error: "boom" }, 500);

		let signed = await new JWT({
			sub: "user-123",
			iss: ISSUER,
			aud: AUDIENCE,
			exp: "1h",
		}).sign(JWK.Algorithm.ES256, [foreign]);

		await expect(issuer.verifyIdToken(signed, { audience: AUDIENCE })).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, AuthErrorCode.JwksFailed),
		);
	});

	test("reads a token failing a claim check as an invalid token", async () => {
		let published = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([published]));

		let issuer = new Issuer(ISSUER);
		let signed = await new JWT({
			sub: "user-123",
			iss: ISSUER,
			aud: "another-client",
			exp: "1h",
		}).sign(JWK.Algorithm.ES256, [published]);

		await expect(issuer.verifyIdToken(signed, { audience: AUDIENCE })).rejects.toSatisfy(
			(error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken),
		);
	});
});

describe("caching", () => {
	test("spends one fetch per document however many times it is read", async () => {
		let pair = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([pair]));

		let issuer = new Issuer(ISSUER);

		for (let index = 0; index < 5; index += 1) {
			await issuer.metadata();
			await issuer.keys();
			await issuer.tokenEndpoint();
		}

		expect(count(DISCOVERY_URL)).toBe(1);
		expect(count(JWKS_URL)).toBe(1);
	});

	test("spends one fetch per document across concurrent reads", async () => {
		let pair = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([pair]));

		let issuer = new Issuer(ISSUER);

		await Promise.all([issuer.keys(), issuer.keys(), issuer.metadata(), issuer.metadata()]);

		expect(count(DISCOVERY_URL)).toBe(1);
		expect(count(JWKS_URL)).toBe(1);
	});

	test("fetches the document again after a failed read", async () => {
		respond(DISCOVERY_URL, { error: "boom" }, 500);

		let issuer = new Issuer(ISSUER);

		await expect(issuer.metadata()).rejects.toThrow(AuthError);

		server.resetHandlers();
		respond(DISCOVERY_URL, document());

		await expect(issuer.identifier()).resolves.toBe(ISSUER);
		expect(count(DISCOVERY_URL)).toBe(2);
	});

	test("accepts a KV-backed store as its cache", () => {
		/**
		 * The assignment is the assertion: a `cache` option a KV-backed store cannot be
		 * passed to fails typechecking here, at the package's own boundary.
		 */
		let accept = (store: Cache.KVStore): Issuer.CacheStore => store;

		expect(accept).toBeTypeOf("function");
	});

	test("serves a second instance from the shared cache", async () => {
		let pair = await keyPair();
		respond(DISCOVERY_URL, document());
		respond(JWKS_URL, JWK.toJSON([pair]));

		let cache = new MemoryCacheStore();

		let warm = new Issuer(ISSUER, { cache });
		await warm.metadata();
		await warm.keys();

		server.resetHandlers();

		let cold = new Issuer(ISSUER, { cache });
		let signed = await new JWT({ sub: "user-123", iss: ISSUER, exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			[pair],
		);

		let verified = await JWT.verify(signed, await cold.keys(), {
			...VERIFY,
			issuer: await cold.identifier(),
		});

		expect(verified.subject).toBe("user-123");
		expect(cache.entries.size).toBe(2);
	});
});

describe("Issuer.for", () => {
	test("spends one fetch per document across two acquisitions", async () => {
		let pair = await keyPair();
		let { origin, discovery, jwks } = freshProvider(pair);

		let first = Issuer.for(origin);
		await first.metadata();
		await first.keys();

		let second = Issuer.for(origin);
		await second.metadata();
		await second.keys();

		expect(second).toBe(first);
		expect(count(discovery)).toBe(1);
		expect(count(jwks)).toBe(1);
	});

	test("keys an instance on the identifier a token's `iss` is held to", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		expect(Issuer.for(origin, { identifier: origin })).not.toBe(Issuer.for(origin));
	});

	test("keys an instance on the TTL its documents are shared for", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		expect(Issuer.for(origin, { ttl: "5 minutes" })).not.toBe(Issuer.for(origin, { ttl: "1 day" }));
	});

	test("keys an instance on the metadata it serves in place of a fetched document", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		let metadata: Issuer.Metadata = {
			issuer: origin,
			authorization_endpoint: `${origin}/oauth/authorize`,
			token_endpoint: `${origin}/oauth/token`,
			jwks_uri: `${origin}/.well-known/jwks.json`,
		};

		expect(Issuer.for(origin, { metadata })).not.toBe(Issuer.for(origin));
	});

	test("reads a trailing slash as the same address", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		expect(Issuer.for(`${origin}/`)).toBe(Issuer.for(origin));
	});

	test("refuses an address carrying no scheme", () => {
		expect(() => Issuer.for("auth.test")).toThrow(/absolute URL/);
	});
});

describe("a cache stated as a factory", () => {
	test("resolves the store belonging to the read reaching for it", async () => {
		let pair = await keyPair();
		let { origin, discovery, jwks } = freshProvider(pair);

		let first = new MemoryCacheStore();
		let second = new MemoryCacheStore();
		let current = first;

		let issuer = Issuer.for(origin, { cache: () => current });

		await issuer.metadata();
		expect(first.entries.size).toBe(1);

		current = second;
		await issuer.keys();

		expect(second.entries.size).toBe(1);
		expect(first.entries.size).toBe(1);
		expect(count(discovery)).toBe(1);
		expect(count(jwks)).toBe(1);
	});

	test("shares what an earlier store already held", async () => {
		let pair = await keyPair();
		let { origin, discovery } = freshProvider(pair);

		let cache = new MemoryCacheStore();

		let warm = new Issuer(origin, { cache: () => cache });
		await warm.metadata();

		server.resetHandlers();

		let cold = new Issuer(origin, { cache: () => cache });

		await expect(cold.identifier()).resolves.toBe(origin);
		expect(count(discovery)).toBe(1);
	});
});

describe("verifyIdToken", () => {
	test("answers with the claims a session is minted from", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		let idToken = await Issuer.for(origin).verifyIdToken(
			await signIdToken(origin, pair, { email: "owner@example.test", sid: "session-1" }),
			{ audience: AUDIENCE },
		);

		expect(idToken.subject).toBe("user-123");
		expect(idToken.email).toBe("owner@example.test");
		expect(idToken.sessionId).toBe("session-1");
	});

	test("leaves the `nonce` for the login that asked for it to compare", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		let idToken = await Issuer.for(origin).verifyIdToken(
			await signIdToken(origin, pair, { nonce: "nonce-abc" }),
			{ audience: AUDIENCE },
		);

		expect(idToken.nonce).toBe("nonce-abc");
	});

	test("tolerates a minute of drift on the lifetime claims", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);
		let now = Math.floor(Date.now() / 1000);

		let idToken = await Issuer.for(origin).verifyIdToken(
			await signIdToken(origin, pair, { exp: now - 30, nbf: now - 300 }),
			{ audience: AUDIENCE },
		);

		expect(idToken.subject).toBe("user-123");
	});

	test("refuses a token expired beyond the tolerated drift", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);
		let now = Math.floor(Date.now() / 1000);

		await expect(
			Issuer.for(origin).verifyIdToken(
				await signIdToken(origin, pair, { exp: now - 3600, nbf: now - 7200 }),
				{ audience: AUDIENCE },
			),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("holds the drift to the seconds the caller states", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);
		let now = Math.floor(Date.now() / 1000);

		await expect(
			Issuer.for(origin).verifyIdToken(
				await signIdToken(origin, pair, { exp: now - 30, nbf: now - 300 }),
				{ audience: AUDIENCE, clockTolerance: 0 },
			),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("refuses a token naming another issuer", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		await expect(
			Issuer.for(origin).verifyIdToken(
				await signIdToken(origin, pair, { iss: "https://evil.test" }),
				{ audience: AUDIENCE },
			),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("refuses a token issued for another client", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		await expect(
			Issuer.for(origin).verifyIdToken(await signIdToken(origin, pair), {
				audience: "some-other-client",
			}),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("accepts a token naming any one of the audiences stated", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		let idToken = await Issuer.for(origin).verifyIdToken(await signIdToken(origin, pair), {
			audience: ["another-client", AUDIENCE],
		});

		expect(idToken.subject).toBe("user-123");
	});

	test("refuses a token signed by a key the issuer does not publish", async () => {
		let pair = await keyPair();
		let other = await keyPair();
		let { origin } = freshProvider(pair);

		await expect(
			Issuer.for(origin).verifyIdToken(await signIdToken(origin, other), {
				audience: AUDIENCE,
			}),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("refuses a token presenting an algorithm outside the ones stated", async () => {
		let edwards = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.EdDSA));
		let { origin } = freshProvider(edwards);

		await expect(
			Issuer.for(origin).verifyIdToken(
				await signIdToken(origin, edwards, {}, JWK.Algorithm.EdDSA),
				{ audience: AUDIENCE, algorithms: [JWK.Algorithm.ES256] },
			),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("refuses a credential that is not a JWT at all", async () => {
		let pair = await keyPair();
		let { origin } = freshProvider(pair);

		await expect(
			Issuer.for(origin).verifyIdToken("not.a.jwt", { audience: AUDIENCE }),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.InvalidToken));
	});

	test("reports an unreadable key set as the issuer failure it is", async () => {
		let pair = await keyPair();
		let { origin, jwks } = freshProvider(pair);

		respond(jwks, { keys: [] });

		await expect(
			Issuer.for(origin).verifyIdToken(await signIdToken(origin, pair), { audience: AUDIENCE }),
		).rejects.toSatisfy((error: unknown) => AuthError.is(error, AuthErrorCode.JwksFailed));
	});
});
