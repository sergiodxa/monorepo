/**
 * Covers the grant a service runs for itself: the wire format of its resource indicators,
 * the caching and single-flighting that keep one token per resource set, both client
 * authentication methods, introspection, and revocation. The raw body is asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Adapter, RateLimitDecision } from "@sdxc/rate-limit";
import type { Result } from "@sdxc/result";

import { MemoryAdapter, RateLimitError } from "@sdxc/rate-limit";
import { failure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { AuthError, AuthErrorCode } from "./auth-error";
import { Issuer } from "./issuer";
import { ServiceClient } from "./service-client";

/** Issuer identifier every test's metadata names. */
const ISSUER_URL = "https://auth.example.com";

/** Where the `client_credentials` grant is exchanged. */
const TOKEN_ENDPOINT = `${ISSUER_URL}/oauth/token`;

/** Where a token is presented for the issuer to describe. */
const INTROSPECTION_ENDPOINT = `${ISSUER_URL}/oauth/introspect`;

/** Where a token is surrendered. */
const REVOCATION_ENDPOINT = `${ISSUER_URL}/oauth/revoke`;

/** Inline metadata, so no test spends a round-trip on discovery. */
const METADATA: Issuer.Metadata = {
	issuer: ISSUER_URL,
	authorization_endpoint: `${ISSUER_URL}/authorize`,
	token_endpoint: TOKEN_ENDPOINT,
	jwks_uri: `${ISSUER_URL}/.well-known/jwks.json`,
	introspection_endpoint: INTROSPECTION_ENDPOINT,
	revocation_endpoint: REVOCATION_ENDPOINT,
};

/** Seconds the provider's own tokens live, long enough to stay fresh in a test. */
const LIFETIME = 3600;

/** What one intercepted call carried, kept as text so encoding stays visible. */
interface Recorded {
	/** The request body exactly as it went on the wire. */
	body: string;
	/** The `Authorization` header, populated for `client_secret_basic`. */
	authorization: string | null;
}

/**
 * A cache tier held in a `Map`, standing in for the KV-backed store. Tests read
 * its entries to assert what a key is built from and rewrite them to place a
 * token near its expiry.
 */
class MemoryStore implements Issuer.CacheStore {
	/** Stored entries with the TTL each was written under. */
	entries = new Map<string, { value: string; ttl: DurationInput | undefined }>();

	/** Answers `null` for an absent key, the same as a store whose entry expired. */
	async read(key: string): Promise<string | null> {
		return this.entries.get(key)?.value ?? null;
	}

	/** Keeps the TTL alongside the value so a test can assert what it was written with. */
	async write(key: string, value: string, options?: { ttl?: DurationInput }): Promise<void> {
		this.entries.set(key, { value, ttl: options?.ttl });
	}

	/** Reads through to `load` on a miss, storing what it produced. */
	async fetch(
		key: string,
		load: () => Promise<string>,
		options?: { ttl?: DurationInput },
	): Promise<string> {
		let cached = await this.read(key);
		if (cached !== null) return cached;
		let value = await load();
		await this.write(key, value, options);
		return value;
	}
}

/**
 * A limiter whose backend is down, standing in for the outage the client is asked
 * to keep working through.
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

/** MSW server intercepting the three endpoints a service client posts to. */
let server = setupServer();

/** Everything the token endpoint received, in order. */
let grants: Recorded[] = [];

/** Everything the introspection endpoint received, in order. */
let introspections: Recorded[] = [];

/** Everything the revocation endpoint received, in order. */
let revocations: Recorded[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
	grants = [];
	introspections = [];
	revocations = [];
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Builds an issuer over the inline metadata, letting one test drop an endpoint
 * from the document by naming it `undefined`.
 *
 * @param overrides - Metadata members to replace.
 */
function issuerFor(overrides: Partial<Issuer.Metadata> = {}): Issuer {
	return new Issuer(ISSUER_URL, { metadata: { ...METADATA, ...overrides } });
}

/** Records one intercepted request as text. */
async function record(into: Recorded[], request: Request): Promise<void> {
	into.push({ body: await request.text(), authorization: request.headers.get("authorization") });
}

/**
 * Serves the token endpoint, minting a distinct token per call so a test can tell
 * a cached token from a freshly granted one.
 *
 * @param expiresIn - Lifetime the provider states, in seconds.
 */
function serveToken(expiresIn: number | null = LIFETIME): void {
	server.use(
		http.post(TOKEN_ENDPOINT, async ({ request }) => {
			await record(grants, request);
			return HttpResponse.json({
				access_token: `access-token-${grants.length}`,
				token_type: "Bearer",
				...(expiresIn === null ? {} : { expires_in: expiresIn }),
			});
		}),
	);
}

/** Seconds since the epoch, offset by the given number of seconds. */
function epoch(offset = 0): number {
	return Math.floor(Date.now() / 1000) + offset;
}

/**
 * A compact JWS carrying the given claims. A grant is read for its claims and never
 * verified here, so the signature segment stays a placeholder.
 *
 * @param claims - The claims the token states for itself.
 */
function jwt(claims: Record<string, unknown>): string {
	let encode = (value: unknown) =>
		btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${encode({ alg: "ES256", typ: "JWT" })}.${encode(claims)}.signature`;
}

/**
 * Serves the token endpoint with exactly the credential and stated lifetime a test
 * dictates, so which of the two states the token's life is the thing under test.
 *
 * @param accessToken - The credential the provider hands out.
 * @param expiresIn - Lifetime the provider states, left off when `null`.
 */
function serveTokenValue(accessToken: string, expiresIn: number | null): void {
	server.use(
		http.post(TOKEN_ENDPOINT, async ({ request }) => {
			await record(grants, request);
			return HttpResponse.json({
				access_token: accessToken,
				token_type: "Bearer",
				...(expiresIn === null ? {} : { expires_in: expiresIn }),
			});
		}),
	);
}

/**
 * Serves the token endpoint's refusal, in the shape RFC 6749 §5.2 defines.
 *
 * @param status - Status the provider answers with.
 */
function refuseToken(status = 401): void {
	server.use(
		http.post(TOKEN_ENDPOINT, async ({ request }) => {
			await record(grants, request);
			return HttpResponse.json(
				{ error: "invalid_client", error_description: "Invalid client credentials" },
				{ status },
			);
		}),
	);
}

/**
 * Serves the token endpoint with a body carried as a blob, so the answer declares
 * exactly the media type a test names and nothing when it names none.
 *
 * @param body - The raw body the provider answers with.
 * @param contentType - The media type the provider declares, left off when absent.
 */
function serveTokenAs(body: string, contentType?: string): void {
	server.use(
		http.post(TOKEN_ENDPOINT, async ({ request }) => {
			await record(grants, request);
			let headers = contentType === undefined ? undefined : { "content-type": contentType };
			return new HttpResponse(new Blob([body]), { headers });
		}),
	);
}

/** A client over the served metadata, authenticating with the default method. */
function clientFor(
	options: Partial<ServiceClient.Options> = {},
	issuer = issuerFor(),
): ServiceClient {
	return new ServiceClient(issuer, {
		clientId: "client-1",
		clientSecret: "secret-1",
		...options,
	});
}

describe("issuer", () => {
	test("hands out the provider it was configured against", () => {
		let issuer = issuerFor();
		let client = clientFor({}, issuer);

		expect(client.issuer).toBe(issuer);
		expect(client.issuer.url.href).toBe(`${ISSUER_URL}/`);
	});
});

describe("token", () => {
	test("exchanges the client credentials for an access token", async () => {
		serveToken();

		await expect(clientFor().token()).resolves.toBe("access-token-1");

		expect(grants).toHaveLength(1);
		expect(new URLSearchParams(grants[0]!.body).get("grant_type")).toBe("client_credentials");
	});

	test("sends the credentials in the body under `client_secret_post`", async () => {
		serveToken();

		await clientFor().token();

		let body = new URLSearchParams(grants[0]!.body);
		expect(body.get("client_id")).toBe("client-1");
		expect(body.get("client_secret")).toBe("secret-1");
		expect(grants[0]!.authorization).toBeNull();
	});

	test("sends the requested scopes as one space-separated field", async () => {
		serveToken();

		await clientFor({ scope: ["monitors:read", "monitors:write"] }).token();

		expect(new URLSearchParams(grants[0]!.body).get("scope")).toBe("monitors:read monitors:write");
	});

	test("merges the configured token parameters into the request", async () => {
		serveToken();

		await clientFor({ tokenParams: { audience: "https://api.example.com" } }).token();

		expect(new URLSearchParams(grants[0]!.body).get("audience")).toBe("https://api.example.com");
	});

	test("refuses a token parameter the grant itself owns", () => {
		expect(() => clientFor({ tokenParams: { grant_type: "password" } })).toThrow(AuthError);

		try {
			clientFor({ tokenParams: { resource: "https://api.example.com" } });
			expect.unreachable();
		} catch (error) {
			expect(AuthError.is(error, AuthErrorCode.ReservedParameter)).toBe(true);
		}
	});

	test("throws `TokenRequestFailed` carrying the provider's error", async () => {
		refuseToken();

		try {
			await clientFor().token();
			expect.unreachable();
		} catch (error) {
			expect(AuthError.is(error, AuthErrorCode.TokenRequestFailed)).toBe(true);
			expect(error).toMatchObject({
				providerError: "invalid_client",
				providerErrorDescription: "Invalid client credentials",
			});
		}
	});

	test("throws `TokenRequestFailed` for a grant declared as HTML, naming the type", async () => {
		serveTokenAs(
			JSON.stringify({ access_token: "access-token-1", token_type: "Bearer" }),
			"text/html",
		);

		await expect(clientFor().token()).rejects.toSatisfy(
			(error: unknown) =>
				AuthError.is(error, AuthErrorCode.TokenRequestFailed) &&
				error.message.includes("text/html"),
		);
	});

	test("reads a grant from an answer that declares no media type", async () => {
		serveTokenAs(JSON.stringify({ access_token: "access-token-1", token_type: "Bearer" }));

		expect(await clientFor().token()).toBe("access-token-1");
	});

	test("throws `TokenRequestFailed` when the answer cannot be read as a grant", async () => {
		server.use(
			http.post(TOKEN_ENDPOINT, async ({ request }) => {
				await record(grants, request);
				return HttpResponse.json({ token_type: "Bearer" });
			}),
		);

		await expect(clientFor().token()).rejects.toMatchObject({
			code: AuthErrorCode.TokenRequestFailed,
		});
	});
});

describe("resource indicators", () => {
	test("sends each resource as its own `resource` field", async () => {
		serveToken();

		await clientFor().token({
			resources: ["https://api.example.com", "https://reports.example.com"],
		});

		expect(new URLSearchParams(grants[0]!.body).getAll("resource")).toEqual([
			"https://api.example.com",
			"https://reports.example.com",
		]);
	});

	test("keeps the resources unjoined in the raw body", async () => {
		serveToken();

		await clientFor().token({ resources: ["https://a.example.com", "https://b.example.com"] });

		let fields = grants[0]!.body.split("&").filter((field) => field.startsWith("resource="));
		expect(fields).toHaveLength(2);
		expect(grants[0]!.body).not.toContain("%2C");
	});

	test("sends a single resource as one field", async () => {
		serveToken();

		await clientFor().token({ resources: ["https://api.example.com"] });

		expect(new URLSearchParams(grants[0]!.body).getAll("resource")).toEqual([
			"https://api.example.com",
		]);
	});

	test("sends no `resource` field when none was asked for", async () => {
		serveToken();

		await clientFor().token();

		expect(new URLSearchParams(grants[0]!.body).has("resource")).toBe(false);
	});
});

describe("single flight", () => {
	test("spends one request on repeated calls for the same resource set", async () => {
		serveToken();
		let client = clientFor();

		let first = await client.token({ resources: ["https://api.example.com"] });
		let second = await client.token({ resources: ["https://api.example.com"] });
		let third = await client.token({ resources: ["https://api.example.com"] });

		expect([first, second, third]).toEqual(["access-token-1", "access-token-1", "access-token-1"]);
		expect(grants).toHaveLength(1);
	});

	test("spends one request on concurrent calls for the same resource set", async () => {
		serveToken();
		let client = clientFor();

		let tokens = await Promise.all([
			client.token({ resources: ["https://api.example.com"] }),
			client.token({ resources: ["https://api.example.com"] }),
			client.token({ resources: ["https://api.example.com"] }),
		]);

		expect(tokens).toEqual(["access-token-1", "access-token-1", "access-token-1"]);
		expect(grants).toHaveLength(1);
	});

	test("grants a separate token per resource set", async () => {
		serveToken();
		let client = clientFor();

		let api = await client.token({ resources: ["https://api.example.com"] });
		let reports = await client.token({ resources: ["https://reports.example.com"] });

		expect(api).toBe("access-token-1");
		expect(reports).toBe("access-token-2");
		expect(grants).toHaveLength(2);
	});

	test("grants a separate token per scope set", async () => {
		serveToken();
		let client = clientFor();

		await client.token({ scope: ["monitors:read"] });
		await client.token({ scope: ["monitors:write"] });

		expect(grants).toHaveLength(2);
	});

	test("reuses one token for the same resources named in another order", async () => {
		serveToken();
		let client = clientFor();

		await client.token({ resources: ["https://a.example.com", "https://b.example.com"] });
		await client.token({ resources: ["https://b.example.com", "https://a.example.com"] });

		expect(grants).toHaveLength(1);
	});

	test("grants per call while the issuer states no lifetime", async () => {
		serveToken(null);
		let client = clientFor();

		await expect(client.token()).resolves.toBe("access-token-1");
		await expect(client.token()).resolves.toBe("access-token-2");
	});

	test("grants again after a refusal, so a transient failure is retried", async () => {
		refuseToken();
		let client = clientFor();

		await expect(client.token()).rejects.toBeInstanceOf(AuthError);
		await expect(client.token()).rejects.toBeInstanceOf(AuthError);

		expect(grants).toHaveLength(2);
	});
});

describe("token lifetime", () => {
	test("reuses a signed token on its own `exp` where the issuer states no lifetime", async () => {
		serveTokenValue(jwt({ exp: epoch(LIFETIME) }), null);
		let client = clientFor();

		await client.token();
		await client.token();

		expect(grants).toHaveLength(1);
	});

	test("reuses an opaque token on the lifetime the issuer stated", async () => {
		serveTokenValue("opaque-token", LIFETIME);
		let client = clientFor();

		await client.token();
		await client.token();

		expect(grants).toHaveLength(1);
	});

	test("grants per call when neither the token nor the issuer states a lifetime", async () => {
		serveTokenValue("opaque-token", null);
		let client = clientFor();

		await client.token();
		await client.token();

		expect(grants).toHaveLength(2);
	});

	test("reads a signed token's `exp` over a stated lifetime that disagrees", async () => {
		serveTokenValue(jwt({ exp: epoch(LIFETIME) }), 1);
		let live = clientFor();

		await live.token();
		await live.token();

		expect(grants).toHaveLength(1);

		serveTokenValue(jwt({ exp: epoch(-1) }), LIFETIME);
		let lapsed = clientFor();

		await lapsed.token();
		await lapsed.token();

		expect(grants).toHaveLength(3);
	});

	test("stores the shared entry under the signed `exp` rather than the stated lifetime", async () => {
		serveTokenValue(jwt({ exp: epoch(LIFETIME) }), 120);
		let cache = new MemoryStore();

		await clientFor({ cache, expirationMargin: "1 minute" }).token();

		let entry = [...cache.entries.values()][0]!;
		expect(entry.ttl).toBe(LIFETIME - 60);
	});
});

describe("shared cache", () => {
	test("serves a token another isolate stored", async () => {
		serveToken();
		let cache = new MemoryStore();

		await clientFor({ cache }).token();
		let token = await clientFor({ cache }).token();

		expect(token).toBe("access-token-1");
		expect(grants).toHaveLength(1);
	});

	test("keys the entry by the client id and the resource set", async () => {
		serveToken();
		let cache = new MemoryStore();

		await clientFor({ cache }).token({ resources: ["https://api.example.com"] });

		let key = [...cache.entries.keys()][0]!;
		expect(key).toContain("client-1");
		expect(key).toContain("https://api.example.com");
	});

	test("stores one entry per resource set", async () => {
		serveToken();
		let cache = new MemoryStore();
		let client = clientFor({ cache });

		await client.token({ resources: ["https://api.example.com"] });
		await client.token({ resources: ["https://reports.example.com"] });

		expect(cache.entries.size).toBe(2);
	});

	test("grants a fresh token when the stored one is inside the expiry margin", async () => {
		serveToken();
		let cache = new MemoryStore();

		await clientFor({ cache, expirationMargin: "1 minute" }).token();

		let key = [...cache.entries.keys()][0]!;
		await cache.write(
			key,
			JSON.stringify({
				access_token: "access-token-1",
				expires_at: Math.floor(Date.now() / 1000) + 30,
			}),
			{},
		);

		let token = await clientFor({ cache, expirationMargin: "1 minute" }).token();

		expect(token).toBe("access-token-2");
		expect(grants).toHaveLength(2);
	});

	test("grants a fresh token when the stored entry cannot be read", async () => {
		serveToken();
		let cache = new MemoryStore();

		await clientFor({ cache }).token();

		let key = [...cache.entries.keys()][0]!;
		await cache.write(key, "not json", {});

		await expect(clientFor({ cache }).token()).resolves.toBe("access-token-2");
	});

	test("stores the entry under a TTL shortened by the expiry margin", async () => {
		serveToken();
		let cache = new MemoryStore();

		await clientFor({ cache, expirationMargin: "1 minute" }).token();

		let entry = [...cache.entries.values()][0]!;
		expect(entry.ttl).toBe(LIFETIME - 60);
	});

	test("keeps a short-lived token in the isolate when a shared write would be rejected", async () => {
		serveToken(45);
		let cache = new MemoryStore();

		await expect(clientFor({ cache }).token()).resolves.toBe("access-token-1");

		expect(cache.entries.size).toBe(0);
	});
});

describe("client_secret_basic", () => {
	test("authenticates with the credentials in the header", async () => {
		serveToken();

		await clientFor({ clientAuth: "client_secret_basic" }).token();

		expect(grants[0]!.authorization).toBe(`Basic ${btoa("client-1:secret-1")}`);
		expect(new URLSearchParams(grants[0]!.body).has("client_secret")).toBe(false);
	});

	test("form-urlencodes both halves before encoding them", async () => {
		serveToken();

		await new ServiceClient(issuerFor(), {
			clientId: "client one",
			clientSecret: "secret:with+special &chars",
			clientAuth: "client_secret_basic",
		}).token();

		expect(grants[0]!.authorization).toBe(
			`Basic ${btoa("client+one:secret%3Awith%2Bspecial+%26chars")}`,
		);
	});

	test("carries a secret outside ASCII through the header", async () => {
		serveToken();

		await new ServiceClient(issuerFor(), {
			clientId: "client-1",
			clientSecret: "secret-\u00a3-\u{1f510}",
			clientAuth: "client_secret_basic",
		}).token();

		expect(grants[0]!.authorization).toBe("Basic Y2xpZW50LTE6c2VjcmV0LSVDMiVBMy0lRjAlOUYlOTQlOTA=");
		expect(atob(grants[0]!.authorization!.slice("Basic ".length))).toBe(
			"client-1:secret-%C2%A3-%F0%9F%94%90",
		);
	});

	test("names the client in the body so the issuer can identify it", async () => {
		serveToken();

		await clientFor({ clientAuth: "client_secret_basic" }).token();

		expect(new URLSearchParams(grants[0]!.body).get("client_id")).toBe("client-1");
	});
});

describe("introspect", () => {
	test("describes an active token", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, async ({ request }) => {
				await record(introspections, request);
				return HttpResponse.json({
					active: true,
					sub: "client-1",
					client_id: "client-1",
					scope: "monitors:read monitors:write",
					token_type: "Bearer",
					aud: [ISSUER_URL, "https://api.example.com"],
					iss: ISSUER_URL,
					exp: 1_700_000_600,
					iat: 1_700_000_000,
					username: "reporter",
				});
			}),
		);

		let introspection = await clientFor().introspect("opaque-token");

		expect(introspection).toEqual({
			active: true,
			subject: "client-1",
			clientId: "client-1",
			scopes: ["monitors:read", "monitors:write"],
			tokenType: "Bearer",
			audience: [ISSUER_URL, "https://api.example.com"],
			issuer: ISSUER_URL,
			expiresAt: new Date(1_700_000_600_000),
			issuedAt: new Date(1_700_000_000_000),
			username: "reporter",
		});
		expect(new URLSearchParams(introspections[0]!.body).get("token")).toBe("opaque-token");
	});

	test("describes an inactive token as the issuer's bare answer", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, async ({ request }) => {
				await record(introspections, request);
				return HttpResponse.json({ active: false });
			}),
		);

		let introspection = await clientFor().introspect("opaque-token");

		expect(introspection).toEqual({
			active: false,
			subject: null,
			clientId: null,
			scopes: [],
			tokenType: null,
			audience: [],
			issuer: null,
			expiresAt: null,
			issuedAt: null,
			username: null,
		});
	});

	test("reads a single-valued `aud` as a one-element list", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, () =>
				HttpResponse.json({ active: true, aud: "https://api.example.com" }),
			),
		);

		let introspection = await clientFor().introspect("opaque-token");

		expect(introspection.audience).toEqual(["https://api.example.com"]);
	});

	test("sends the token type hint the caller supplied", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, async ({ request }) => {
				await record(introspections, request);
				return HttpResponse.json({ active: true });
			}),
		);

		await clientFor().introspect("opaque-token", { tokenType: "refresh_token" });

		expect(new URLSearchParams(introspections[0]!.body).get("token_type_hint")).toBe(
			"refresh_token",
		);
	});

	test("authenticates the call with the client credentials", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, async ({ request }) => {
				await record(introspections, request);
				return HttpResponse.json({ active: true });
			}),
		);

		await clientFor({ clientAuth: "client_secret_basic" }).introspect("opaque-token");

		expect(introspections[0]!.authorization).toBe(`Basic ${btoa("client-1:secret-1")}`);
	});

	test("throws `InvalidToken` when the answer says nothing about the token", async () => {
		server.use(http.post(INTROSPECTION_ENDPOINT, () => HttpResponse.json({ sub: "client-1" })));

		await expect(clientFor().introspect("opaque-token")).rejects.toMatchObject({
			code: AuthErrorCode.InvalidToken,
		});
	});

	test("throws `IntrospectionFailed` when the issuer refuses the call", async () => {
		server.use(
			http.post(INTROSPECTION_ENDPOINT, () =>
				HttpResponse.json({ error: "invalid_client" }, { status: 401 }),
			),
		);

		await expect(clientFor().introspect("opaque-token")).rejects.toMatchObject({
			code: AuthErrorCode.IntrospectionFailed,
			providerError: "invalid_client",
		});
	});

	test("throws `EndpointUnsupported` for an issuer advertising none", async () => {
		let issuer = issuerFor({ introspection_endpoint: undefined });

		await expect(clientFor({}, issuer).introspect("opaque-token")).rejects.toMatchObject({
			code: AuthErrorCode.EndpointUnsupported,
		});
	});
});

describe("revoke", () => {
	test("surrenders the token", async () => {
		server.use(
			http.post(REVOCATION_ENDPOINT, async ({ request }) => {
				await record(revocations, request);
				return new HttpResponse(null, { status: 200 });
			}),
		);

		await clientFor().revoke("access-token-1");

		let body = new URLSearchParams(revocations[0]!.body);
		expect(body.get("token")).toBe("access-token-1");
		expect(body.get("client_id")).toBe("client-1");
	});

	test("sends the token type hint the caller supplied", async () => {
		server.use(
			http.post(REVOCATION_ENDPOINT, async ({ request }) => {
				await record(revocations, request);
				return new HttpResponse(null, { status: 200 });
			}),
		);

		await clientFor().revoke("refresh-token-1", { tokenType: "refresh_token" });

		expect(new URLSearchParams(revocations[0]!.body).get("token_type_hint")).toBe("refresh_token");
	});

	test("hands the call to `waitUntil`, so the caller answers first", async () => {
		let open = (): void => {};
		let gate = new Promise<void>((resolve) => {
			open = resolve;
		});

		server.use(
			http.post(REVOCATION_ENDPOINT, async ({ request }) => {
				await gate;
				await record(revocations, request);
				return new HttpResponse(null, { status: 200 });
			}),
		);

		let deferred: Promise<unknown>[] = [];
		let client = clientFor({ waitUntil: (promise) => void deferred.push(promise) });

		await client.revoke("access-token-1");

		expect(revocations).toHaveLength(0);
		expect(deferred).toHaveLength(1);

		open();
		await Promise.all(deferred);

		expect(revocations).toHaveLength(1);
	});

	test("throws `RevocationFailed` when the issuer refuses the call", async () => {
		server.use(
			http.post(REVOCATION_ENDPOINT, () =>
				HttpResponse.json({ error: "invalid_client" }, { status: 401 }),
			),
		);

		await expect(clientFor().revoke("access-token-1")).rejects.toMatchObject({
			code: AuthErrorCode.RevocationFailed,
			providerError: "invalid_client",
		});
	});

	test("throws `EndpointUnsupported` for an issuer advertising none", async () => {
		let issuer = issuerFor({ revocation_endpoint: undefined });

		await expect(clientFor({}, issuer).revoke("access-token-1")).rejects.toMatchObject({
			code: AuthErrorCode.EndpointUnsupported,
		});
	});
});

describe("rateLimit", () => {
	test("grants while the budget holds", async () => {
		serveToken();
		let rateLimit = new MemoryAdapter({ limit: 2, window: "1 minute" });
		let client = clientFor({ rateLimit });

		await expect(client.token({ resources: ["https://a.example.com"] })).resolves.toBe(
			"access-token-1",
		);
		await expect(client.token({ resources: ["https://b.example.com"] })).resolves.toBe(
			"access-token-2",
		);
	});

	test("throws `RateLimited` and leaves the issuer alone once the budget is spent", async () => {
		serveToken();
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });
		let client = clientFor({ rateLimit });

		await client.token({ resources: ["https://a.example.com"] });

		await expect(client.token({ resources: ["https://b.example.com"] })).rejects.toMatchObject({
			code: AuthErrorCode.RateLimited,
		});
		expect(grants).toHaveLength(1);
	});

	test("spends no budget on a token the cache already holds", async () => {
		serveToken();
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });
		let cache = new MemoryStore();

		await clientFor({ rateLimit, cache }).token();

		await expect(clientFor({ rateLimit, cache }).token()).resolves.toBe("access-token-1");
	});

	test("grants while the limiter cannot answer, so scheduled work keeps running", async () => {
		serveToken();
		let client = clientFor({ rateLimit: new UnreachableAdapter() });

		await expect(client.token()).resolves.toBe("access-token-1");
	});

	test("keys the budget by the client id, so one client cannot spend another's", async () => {
		serveToken();
		let rateLimit = new MemoryAdapter({ limit: 1, window: "1 minute" });

		await clientFor({ rateLimit }).token();

		await expect(
			new ServiceClient(issuerFor(), {
				clientId: "client-2",
				clientSecret: "secret-2",
				rateLimit,
			}).token(),
		).resolves.toBe("access-token-2");
	});
});
