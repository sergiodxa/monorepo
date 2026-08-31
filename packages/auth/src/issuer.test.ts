/**
 * Covers what an `Issuer` promises its callers: a validated discovery document, an
 * identity check against the issuer it was asked for, a named error for every way
 * discovery and the key set can fail, keys a token verifies against, and one fetch
 * per document however many callers, isolates, or concurrent calls ask for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@pkg/kv-cache";

import { JWK, JWT } from "@pkg/jwt";
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
 * `iss` is a bare host rather than the URL its documents are served from.
 */
const SCHEMELESS_ISSUER = "auth.test";

/** Pinned so a token claiming another algorithm fails rather than being honored. */
const VERIFY = { algorithms: [JWK.Algorithm.ES256] };

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

		expect(build).toThrow(AuthError);
		expect(build).toThrow(/absolute URL/);
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
		 * passed to fails typechecking here rather than at an app's call site.
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
