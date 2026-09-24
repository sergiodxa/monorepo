/**
 * Covers RFC 9728 discovery from the client's side: metadata found from a resource URL
 * or a `401`'s pointer, held to the resource it was fetched for, and an authorization
 * server's `Issuer` read through RFC 8414 with an OpenID Connect fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, unwrap, wrap } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { AuthError, AuthErrorCode } from "./auth-error.js";

import { Issuer } from "./issuer.js";
import { ProtectedResource } from "./protected-resource.js";

let server = setupServer();

/** How many requests each URL has received since the current test began. */
let requests = new Map<string, number>();

/** Hosts handed out so far, so no two tests share an `Issuer.for` instance. */
let hosts = 0;

/**
 * An origin no earlier test used, so each test's authorization server has memos of
 * its own.
 *
 * @param label - A word naming the role the origin plays.
 */
function origin(label: string): string {
	hosts += 1;
	return `https://${label}-${hosts}.test`;
}

/**
 * Answers a URL with JSON, counting its requests.
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
 * How many requests a URL has received in the current test.
 *
 * @param url - URL to report on.
 */
function count(url: string): number {
	return requests.get(url) ?? 0;
}

/**
 * The discovery document an authorization server publishes.
 *
 * @param issuer - The issuer it names.
 */
function serverMetadata(issuer: string): Issuer.Metadata {
	return {
		issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/token`,
		jwks_uri: `${issuer}/jwks`,
	};
}

/**
 * The code a failed result carries, for asserting which failure it is.
 *
 * @param result - A result expected to have failed.
 */
function codeOf(result: Result<unknown, AuthError>): AuthErrorCode | null {
	return isFailure(result) ? result.error.code : null;
}

/** A refusal carrying the given `WWW-Authenticate` value, or none. */
function refusal(challenge?: string, status = 401): Response {
	let headers: Record<string, string> = {};
	if (challenge !== undefined) headers["www-authenticate"] = challenge;
	return new Response(null, { status, headers });
}

/**
 * A cache whose entries outlive the call that wrote them, standing in for the tier
 * several isolates share.
 */
class MemoryCacheStore implements Issuer.CacheStore {
	readonly entries = new Map<string, string>();

	/** @param key - Entry to read. */
	read(key: string): Promise<Result<string | null, Error>> {
		return Promise.resolve(success(this.entries.get(key) ?? null));
	}

	/**
	 * @param key - Entry to write.
	 * @param value - Value to store.
	 */
	write(key: string, value: string): Promise<Result<void, Error>> {
		this.entries.set(key, value);
		return Promise.resolve(success(undefined));
	}

	/**
	 * Wraps a failed load the way a cache adapter reports one, as its own error
	 * carrying the load's as `cause`.
	 *
	 * @param key - Entry to read.
	 * @param load - Computes the value on a miss.
	 */
	async fetch(key: string, load: () => Promise<string>): Promise<Result<string, Error>> {
		let held = this.entries.get(key);
		if (held !== undefined) return success(held);

		let value = await wrap(load);
		if (isFailure(value)) return failure(new Error("The load failed.", { cause: value.error }));

		this.entries.set(key, value.data);
		return value;
	}
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => requests.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("discover", () => {
	test("reads the metadata served for a resource with a path", async () => {
		let api = origin("api");
		let as = origin("as");
		respond(`${api}/.well-known/oauth-protected-resource/v1`, {
			resource: `${api}/v1`,
			authorization_servers: [as],
			scopes_supported: ["read"],
		});

		let resource = unwrap(await ProtectedResource.discover(`${api}/v1`));

		expect(resource.metadata.resource.href).toBe(`${api}/v1`);
		expect(resource.metadata.authorizationServers).toEqual([new URL(as)]);
		expect(resource.metadata.scopesSupported).toEqual(["read"]);
	});

	test("refuses a document naming another resource", async () => {
		let api = origin("api");
		respond(`${api}/.well-known/oauth-protected-resource`, { resource: "https://evil.test" });

		expect(codeOf(await ProtectedResource.discover(api))).toBe("discovery_failed");
	});

	test("reports a missing document as a discovery failure", async () => {
		let api = origin("api");
		respond(`${api}/.well-known/oauth-protected-resource`, {}, 404);

		expect(codeOf(await ProtectedResource.discover(api))).toBe("discovery_failed");
	});

	test("reports a document declared as something other than JSON", async () => {
		let api = origin("api");
		server.use(
			http.get(`${api}/.well-known/oauth-protected-resource`, () => HttpResponse.text("hello")),
		);

		expect(codeOf(await ProtectedResource.discover(api))).toBe("discovery_failed");
	});

	test("shares a fetched document through the cache", async () => {
		let api = origin("api");
		let url = `${api}/.well-known/oauth-protected-resource`;
		respond(url, { resource: api });
		let cache = new MemoryCacheStore();

		unwrap(await ProtectedResource.discover(api, { cache }));
		unwrap(await ProtectedResource.discover(api, { cache: () => cache }));

		expect(count(url)).toBe(1);
	});

	test("reports a failed fetch through the cache as a discovery failure", async () => {
		let api = origin("api");
		respond(`${api}/.well-known/oauth-protected-resource`, {}, 500);

		let result = await ProtectedResource.discover(api, { cache: new MemoryCacheStore() });

		expect(codeOf(result)).toBe("discovery_failed");
	});
});

describe("fromChallenge", () => {
	test("follows the pointer and checks the document names the requested URL", async () => {
		let api = origin("api");
		let pointer = `${api}/.well-known/oauth-protected-resource/mcp`;
		respond(pointer, { resource: `${api}/mcp` });

		let resource = unwrap(
			await ProtectedResource.fromChallenge(
				refusal(`Bearer error="invalid_token", resource_metadata="${pointer}"`),
				`${api}/mcp`,
			),
		);

		expect(resource?.metadata.resource.href).toBe(`${api}/mcp`);
	});

	test("finds the pointer on a Bearer challenge listed after another scheme", async () => {
		let api = origin("api");
		let pointer = `${api}/.well-known/oauth-protected-resource`;
		respond(pointer, { resource: api });

		let result = await ProtectedResource.fromChallenge(
			refusal(`Basic realm="x", Bearer resource_metadata="${pointer}"`),
			api,
		);

		expect(isSuccess(result) && result.data !== null).toBe(true);
	});

	test("answers null for a refusal with no challenge or no pointer", async () => {
		let api = origin("api");

		expect(unwrap(await ProtectedResource.fromChallenge(refusal(), api))).toBeNull();
		expect(
			unwrap(await ProtectedResource.fromChallenge(refusal(`Bearer realm="api"`), api)),
		).toBeNull();
	});

	test("refuses a document for a resource above the requested URL by default", async () => {
		let api = origin("api");
		let pointer = `${api}/.well-known/oauth-protected-resource/v1`;
		respond(pointer, { resource: `${api}/v1` });
		let challenge = refusal(`Bearer resource_metadata="${pointer}"`);

		let result = await ProtectedResource.fromChallenge(challenge, `${api}/v1/items`);

		expect(codeOf(result)).toBe("discovery_failed");
	});

	test("accepts a resource above the requested URL when prefix matching is asked for", async () => {
		let api = origin("api");
		let pointer = `${api}/.well-known/oauth-protected-resource/v1`;
		respond(pointer, { resource: `${api}/v1` });
		let challenge = refusal(`Bearer resource_metadata="${pointer}"`);

		let resource = unwrap(
			await ProtectedResource.fromChallenge(challenge, `${api}/v1/items`, { match: "prefix" }),
		);

		expect(resource?.metadata.resource.href).toBe(`${api}/v1`);
	});

	test("keeps prefix matching to whole path segments", async () => {
		let api = origin("api");
		let pointer = `${api}/.well-known/oauth-protected-resource/v1`;
		respond(pointer, { resource: `${api}/v1` });
		let challenge = refusal(`Bearer resource_metadata="${pointer}"`);

		let result = await ProtectedResource.fromChallenge(challenge, `${api}/v10`, {
			match: "prefix",
		});

		expect(codeOf(result)).toBe("discovery_failed");
	});

	test("reports an unreadable header as a discovery failure", async () => {
		let result = await ProtectedResource.fromChallenge(refusal(`Bearer realm="x`), origin("api"));

		expect(codeOf(result)).toBe("discovery_failed");
	});
});

describe("requiredScopes", () => {
	test("collects the scopes every Bearer challenge asks for", () => {
		let response = refusal(
			`Bearer error="insufficient_scope", scope="files:read files:write", Bearer scope="files:write user:email"`,
			403,
		);

		expect(ProtectedResource.requiredScopes(response)).toEqual([
			"files:read",
			"files:write",
			"user:email",
		]);
	});

	test("answers an empty list for a response with no readable challenge", () => {
		expect(ProtectedResource.requiredScopes(refusal())).toEqual([]);
		expect(ProtectedResource.requiredScopes(refusal(`Bearer scope="x`))).toEqual([]);
	});
});

describe("issuer", () => {
	/**
	 * A resource listing the given authorization servers, built from metadata the app
	 * already holds.
	 *
	 * @param servers - The servers the resource lists.
	 */
	function resourceListing(...servers: string[]): ProtectedResource {
		return new ProtectedResource({
			resource: new URL("https://api.test"),
			authorizationServers: servers.map((entry) => new URL(entry)),
			jwksUri: null,
			scopesSupported: [],
			bearerMethodsSupported: ["header"],
			resourceSigningAlgValuesSupported: [],
			resourceName: null,
			resourceDocumentation: null,
			resourcePolicyUri: null,
			resourceTosUri: null,
			tlsClientCertificateBoundAccessTokens: false,
			authorizationDetailsTypesSupported: [],
			dpopSigningAlgValuesSupported: [],
			dpopBoundAccessTokensRequired: false,
			signedMetadata: null,
			extensions: {},
		});
	}

	test("reads the first listed server's RFC 8414 metadata, inserted before its path", async () => {
		let as = `${origin("as")}/tenant`;
		let asOrigin = new URL(as).origin;
		respond(`${asOrigin}/.well-known/oauth-authorization-server/tenant`, serverMetadata(as));

		let issuer = unwrap(await resourceListing(as, origin("other")).issuer());

		await expect(issuer.tokenEndpoint()).resolves.toEqual(new URL(`${as}/token`));
	});

	test("falls back to OpenID Connect discovery when RFC 8414 metadata is missing", async () => {
		let as = origin("as");
		respond(`${as}/.well-known/oauth-authorization-server`, {}, 404);
		respond(`${as}/.well-known/openid-configuration`, serverMetadata(as));

		let issuer = unwrap(await resourceListing(as).issuer());

		await expect(issuer.identifier()).resolves.toBe(as);
	});

	test("reads a listed server the caller names", async () => {
		let first = origin("as");
		let second = origin("as");
		respond(`${second}/.well-known/oauth-authorization-server`, serverMetadata(second));

		let issuer = unwrap(await resourceListing(first, second).issuer(`${second}/`));

		await expect(issuer.identifier()).resolves.toBe(second);
	});

	test("refuses a server the resource does not list", async () => {
		let result = await resourceListing(origin("as")).issuer(origin("evil"));

		expect(codeOf(result)).toBe("issuer_mismatch");
	});

	test("refuses a server whose metadata names another issuer, without falling back", async () => {
		let as = origin("as");
		respond(`${as}/.well-known/oauth-authorization-server`, serverMetadata("https://evil.test"));

		let result = await resourceListing(as).issuer();

		expect(codeOf(result)).toBe("issuer_mismatch");
		expect(count(`${as}/.well-known/openid-configuration`)).toBe(0);
	});

	test("reports a resource listing no server", async () => {
		expect(codeOf(await resourceListing().issuer())).toBe("endpoint_unsupported");
	});

	test("reports a server publishing neither document", async () => {
		let as = origin("as");
		respond(`${as}/.well-known/oauth-authorization-server`, {}, 404);
		respond(`${as}/.well-known/openid-configuration`, {}, 404);

		expect(codeOf(await resourceListing(as).issuer())).toBe("discovery_failed");
	});
});
