/**
 * Unit tests for the OIDC relying-party helpers. Focus is on the security-critical
 * claim validation in {@link verifyIdToken}, the S256 PKCE derivation, and the
 * profile/metadata mapping. Network helpers (`discover`, `exchangeCode`,
 * `resolveEndSessionEndpoint`) are exercised against a stubbed `fetch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
	buildAuthorizationUrl,
	createPkce,
	discover,
	exchangeCode,
	type OidcMetadata,
	resolveEndSessionEndpoint,
	toAuthProfile,
	verifyIdToken,
} from "./index";

/** Encodes bytes as unpadded base64url (mirrors the implementation). */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Builds an unsigned compact JWS (header.payload.signature) from claims. */
function makeIdToken(claims: Record<string, unknown>): string {
	let header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
	let payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
	return `${header}.${payload}.signature`;
}

/** A validated set of claims one hour in the future. */
function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		iss: "https://sso.example.com",
		aud: "client-123",
		exp: Math.floor(Date.now() / 1000) + 3600,
		sub: "user-1",
		email: "person@example.com",
		name: "A Person",
		...overrides,
	};
}

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("createPkce", () => {
	test("derives an S256 challenge from the verifier", async () => {
		let pkce = await createPkce();
		expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);

		let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pkce.verifier));
		expect(pkce.challenge).toBe(base64url(new Uint8Array(digest)));
	});

	test("produces a unique verifier per call", async () => {
		let a = await createPkce();
		let b = await createPkce();
		expect(a.verifier).not.toBe(b.verifier);
	});
});

describe("buildAuthorizationUrl", () => {
	let metadata: OidcMetadata = {
		authorization_endpoint: "https://sso.example.com/authorize",
		token_endpoint: "https://sso.example.com/token",
	};

	test("sets the authorization-code + PKCE parameters", () => {
		let url = new URL(
			buildAuthorizationUrl(metadata, {
				clientId: "client-123",
				redirectUri: "https://app.example.com/auth/callback",
				state: "state-abc",
				challenge: "challenge-xyz",
			}),
		);
		expect(url.origin + url.pathname).toBe("https://sso.example.com/authorize");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("client_id")).toBe("client-123");
		expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/auth/callback");
		expect(url.searchParams.get("state")).toBe("state-abc");
		expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
		expect(url.searchParams.get("scope")).toBe("openid profile email");
	});

	test("honors custom scopes", () => {
		let url = new URL(
			buildAuthorizationUrl(metadata, {
				clientId: "client-123",
				redirectUri: "https://app.example.com/auth/callback",
				state: "s",
				challenge: "c",
				scopes: ["openid", "offline_access"],
			}),
		);
		expect(url.searchParams.get("scope")).toBe("openid offline_access");
	});
});

describe("verifyIdToken", () => {
	let expected = { issuer: "https://sso.example.com", clientId: "client-123" };

	test("returns the profile for a valid token", () => {
		let profile = verifyIdToken(makeIdToken(validClaims()), expected);
		expect(profile).toEqual({
			subject: "user-1",
			email: "person@example.com",
			displayName: "A Person",
		});
	});

	test("accepts an audience array containing the client id", () => {
		let token = makeIdToken(validClaims({ aud: ["other", "client-123"] }));
		expect(verifyIdToken(token, expected).subject).toBe("user-1");
	});

	test("ignores trailing slashes when comparing the issuer", () => {
		let token = makeIdToken(validClaims({ iss: "https://sso.example.com/" }));
		expect(verifyIdToken(token, expected).subject).toBe("user-1");
	});

	test("defaults email to empty and displayName to null when absent", () => {
		let token = makeIdToken(validClaims({ email: undefined, name: undefined }));
		let profile = verifyIdToken(token, expected);
		expect(profile.email).toBe("");
		expect(profile.displayName).toBeNull();
	});

	test("rejects a malformed token", () => {
		expect(() => verifyIdToken("not-a-jwt", expected)).toThrow("Malformed ID token");
	});

	test("rejects an issuer mismatch", () => {
		let token = makeIdToken(validClaims({ iss: "https://evil.example.com" }));
		expect(() => verifyIdToken(token, expected)).toThrow("Issuer mismatch");
	});

	test("rejects a missing issuer", () => {
		let token = makeIdToken(validClaims({ iss: undefined }));
		expect(() => verifyIdToken(token, expected)).toThrow("Issuer mismatch");
	});

	test("rejects an audience mismatch", () => {
		let token = makeIdToken(validClaims({ aud: "someone-else" }));
		expect(() => verifyIdToken(token, expected)).toThrow("Audience mismatch");
	});

	test("rejects a missing audience", () => {
		let token = makeIdToken(validClaims({ aud: undefined }));
		expect(() => verifyIdToken(token, expected)).toThrow("Audience mismatch");
	});

	test("rejects an expired token", () => {
		let token = makeIdToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 10 }));
		expect(() => verifyIdToken(token, expected)).toThrow("Token expired or missing expiration");
	});

	test("rejects a token without an expiration", () => {
		let token = makeIdToken(validClaims({ exp: undefined }));
		expect(() => verifyIdToken(token, expected)).toThrow("Token expired or missing expiration");
	});

	test("rejects a token without a subject", () => {
		let token = makeIdToken(validClaims({ sub: undefined }));
		expect(() => verifyIdToken(token, expected)).toThrow("Missing subject");
	});
});

describe("toAuthProfile", () => {
	test("maps all claims when present", () => {
		expect(
			toAuthProfile({
				sub: "user-1",
				email: "person@example.com",
				preferred_username: "person",
				name: "A Person",
				picture: "https://cdn.example.com/a.png",
			}),
		).toEqual({
			subjectId: "user-1",
			email: "person@example.com",
			username: "person",
			displayName: "A Person",
			avatar: "https://cdn.example.com/a.png",
		});
	});

	test("falls back username to the email local-part", () => {
		let profile = toAuthProfile({ sub: "user-1", email: "person@example.com" });
		expect(profile.username).toBe("person");
		expect(profile.displayName).toBe("");
		expect(profile.avatar).toBe("");
	});

	test("yields an empty username when there is no email (empty local-part)", () => {
		// `email` normalizes undefined to "", and "".split("@")[0] is "" (not
		// undefined), so `??` never reaches the subject fallback. This mirrors the
		// original blog-engine behavior and must be preserved.
		let profile = toAuthProfile({ sub: "user-1" });
		expect(profile.username).toBe("");
		expect(profile.email).toBe("");
	});
});

describe("discover", () => {
	// A distinct issuer per test avoids the module-level cache masking a call.
	test("fetches and returns the discovery document", async () => {
		let doc = {
			authorization_endpoint: "https://a.example.com/authorize",
			token_endpoint: "https://a.example.com/token",
		};
		let fetchMock = mock(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify(doc), { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let metadata = await discover("https://a.example.com");
		expect(metadata.token_endpoint).toBe("https://a.example.com/token");
		let requested = fetchMock.mock.calls[0]?.[0];
		expect(requested).toBeInstanceOf(URL);
		if (requested instanceof URL) {
			expect(requested.pathname).toBe("/.well-known/openid-configuration");
		}
	});

	test("caches by issuer across calls", async () => {
		let doc = {
			authorization_endpoint: "https://b.example.com/authorize",
			token_endpoint: "https://b.example.com/token",
		};
		let fetchMock = mock(async () => new Response(JSON.stringify(doc), { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await discover("https://b.example.com");
		await discover("https://b.example.com");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("throws on a non-2xx response", async () => {
		globalThis.fetch = mock(
			async () => new Response("nope", { status: 500 }),
		) as unknown as typeof fetch;
		expect(discover("https://c.example.com")).rejects.toThrow("OIDC discovery failed: 500");
	});
});

describe("exchangeCode", () => {
	let metadata: OidcMetadata = {
		authorization_endpoint: "https://sso.example.com/authorize",
		token_endpoint: "https://sso.example.com/token",
	};

	test("posts with Basic auth and returns the id token", async () => {
		let fetchMock = mock(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ id_token: "the.id.token" }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await exchangeCode(metadata, {
			clientId: "client-123",
			clientSecret: "secret",
			code: "auth-code",
			codeVerifier: "verifier",
			redirectUri: "https://app.example.com/auth/callback",
		});
		expect(result.idToken).toBe("the.id.token");

		let [, init] = fetchMock.mock.calls[0] ?? [];
		expect(init?.method).toBe("POST");
		let headers = init?.headers as Record<string, string>;
		expect(headers.authorization).toBe(`Basic ${btoa("client-123:secret")}`);
		let body = init?.body as URLSearchParams;
		expect(body.get("grant_type")).toBe("authorization_code");
	});

	test("throws with the provider error when present", async () => {
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
		) as unknown as typeof fetch;

		expect(
			exchangeCode(metadata, {
				clientId: "c",
				clientSecret: "s",
				code: "x",
				codeVerifier: "v",
				redirectUri: "https://app.example.com/auth/callback",
			}),
		).rejects.toThrow("invalid_grant");
	});

	test("throws a default message when id_token is missing", async () => {
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify({}), { status: 200 }),
		) as unknown as typeof fetch;

		expect(
			exchangeCode(metadata, {
				clientId: "c",
				clientSecret: "s",
				code: "x",
				codeVerifier: "v",
				redirectUri: "https://app.example.com/auth/callback",
			}),
		).rejects.toThrow("Token exchange failed");
	});
});

describe("resolveEndSessionEndpoint", () => {
	beforeEach(() => {
		globalThis.fetch = mock(
			async () =>
				new Response(JSON.stringify({ end_session_endpoint: "https://d.example.com/logout" }), {
					status: 200,
				}),
		) as unknown as typeof fetch;
	});

	test("prefers inline metadata without a network call", async () => {
		let fetchMock = mock(async () => new Response("{}", { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let endpoint = await resolveEndSessionEndpoint({
			issuer: "https://inline.example.com",
			clientId: "c",
			clientSecret: "s",
			metadata: {
				issuer: "https://inline.example.com",
				authorization_endpoint: "https://inline.example.com/authorize",
				token_endpoint: "https://inline.example.com/token",
				end_session_endpoint: "https://inline.example.com/logout",
			},
		});
		expect(endpoint).toBe("https://inline.example.com/logout");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("discovers and caches the endpoint", async () => {
		let endpoint = await resolveEndSessionEndpoint({
			issuer: "https://d.example.com",
			clientId: "c",
			clientSecret: "s",
		});
		expect(endpoint).toBe("https://d.example.com/logout");
	});

	test("returns null when discovery fails", async () => {
		globalThis.fetch = mock(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;

		let endpoint = await resolveEndSessionEndpoint({
			issuer: "https://e.example.com",
			clientId: "c",
			clientSecret: "s",
		});
		expect(endpoint).toBeNull();
	});
});
