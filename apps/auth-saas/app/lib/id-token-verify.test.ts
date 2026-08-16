/**
 * Behavioural tests for the onboarding ID-token verification. Signs ID tokens with a test
 * ES256 key, publishes the matching JWKS through an injected fetch, and asserts that
 * verification accepts a well-formed token (returning its nonce) and rejects a wrong
 * issuer, wrong audience, expired/not-yet-valid token, a token signed by an unknown key,
 * and an unavailable or empty JWKS. This is the client-side check that replaced trusting a
 * base64-decoded ID-token payload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { JWK, JWT } from "@pkg/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { verifyIdToken } from "./id-token-verify";

let ISSUER = "https://auth.example.test";
let AUDIENCE = "dashboard";
let JWKS_URL = "https://auth.example.test/.well-known/jwks.json";

let keyPair: JWK.KeyPair[];
let otherKeyPair: JWK.KeyPair[];
let jwks: ReturnType<typeof JWK.toJSON>;

/** MSW server intercepting the JWKS fetch. */
let server = setupServer();

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	jwks = JWK.toJSON(keyPair);
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Signs an ID token with the primary test key, allowing individual claims to be
 * overridden to build valid and invalid fixtures.
 */
async function signIdToken(
	overrides: Partial<{
		iss: string;
		aud: string;
		nonce: string;
		exp: number;
		nbf: number;
		sub: string;
		email: string;
		sid: string;
	}> = {},
	keys: JWK.KeyPair[] = keyPair,
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);
	let token = new JWT({
		iss: overrides.iss ?? ISSUER,
		aud: overrides.aud ?? AUDIENCE,
		sub: overrides.sub ?? "subject-123",
		email: overrides.email ?? "owner@example.test",
		email_verified: true,
		sid: overrides.sid ?? "tenant-session-1",
		nonce: overrides.nonce ?? "nonce-abc",
		iat: now,
		nbf: overrides.nbf ?? now,
		exp: overrides.exp ?? now + 300,
		jti: crypto.randomUUID(),
	});
	return token.sign(JWK.Algorithm.ES256, keys);
}

/** Registers an MSW handler serving the given JWKS body with a chosen status. */
function stubJwksFetch(body: unknown, ok = true): void {
	server.use(
		http.get(JWKS_URL, () =>
			HttpResponse.json(body as Record<string, unknown>, { status: ok ? 200 : 503 }),
		),
	);
}

describe("verifyIdToken — accepts", () => {
	test("verifies a well-formed token and returns its claims and nonce", async () => {
		let idToken = await signIdToken();
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});

		expect(result).not.toBeNull();
		expect(result!.nonce).toBe("nonce-abc");
		let claims = result!.claims as { sub: string; email: string; sid: string };
		expect(claims.sub).toBe("subject-123");
		expect(claims.email).toBe("owner@example.test");
		expect(claims.sid).toBe("tenant-session-1");
	});

	test("returns nonce null when the token carries no nonce", async () => {
		// Build a token without a nonce claim.
		let now = Math.floor(Date.now() / 1000);
		let token = new JWT({
			iss: ISSUER,
			aud: AUDIENCE,
			sub: "subject-123",
			email: "owner@example.test",
			iat: now,
			nbf: now,
			exp: now + 300,
			jti: crypto.randomUUID(),
		});
		let idToken = await token.sign(JWK.Algorithm.ES256, keyPair);

		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});

		expect(result).not.toBeNull();
		expect(result!.nonce).toBeNull();
	});
});

describe("verifyIdToken — rejects", () => {
	test("rejects a token with the wrong issuer", async () => {
		let idToken = await signIdToken({ iss: "https://evil.example.test" });
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects a token with the wrong audience", async () => {
		let idToken = await signIdToken({ aud: "some-other-client" });
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects an expired token", async () => {
		let now = Math.floor(Date.now() / 1000);
		let idToken = await signIdToken({ exp: now - 3600, nbf: now - 7200 });
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects a token that is not yet valid (nbf in the future)", async () => {
		let now = Math.floor(Date.now() / 1000);
		let idToken = await signIdToken({ nbf: now + 3600, exp: now + 7200 });
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects a token signed by an unknown key (bad signature)", async () => {
		let idToken = await signIdToken({}, otherKeyPair);
		stubJwksFetch(jwks);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects when the JWKS endpoint is unavailable", async () => {
		let idToken = await signIdToken();
		stubJwksFetch({}, false);
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects when the JWKS contains no keys", async () => {
		let idToken = await signIdToken();
		stubJwksFetch({ keys: [] });
		let result = await verifyIdToken(idToken, {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});

	test("rejects a malformed token string", async () => {
		stubJwksFetch(jwks);
		let result = await verifyIdToken("not.a.jwt", {
			jwksUrl: JWKS_URL,
			issuer: ISSUER,
			audience: AUDIENCE,
		});
		expect(result).toBeNull();
	});
});
