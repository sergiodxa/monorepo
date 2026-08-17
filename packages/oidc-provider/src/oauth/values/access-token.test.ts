import { beforeAll, describe, expect, test } from "bun:test";

import { JWK, JWT } from "@pkg/jwt";

import AccessToken from "./access-token";

let testKeyPair: JWK.KeyPair[];

beforeAll(async () => {
	let rawKeyPair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	testKeyPair = [await JWK.importKeyPair(rawKeyPair)];
});

describe(AccessToken.name, () => {
	describe("generate", () => {
		test("creates token with correct issuer", () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			expect(token.issuer).toBe("https://auth.example.com");
		});

		test("creates token with subject ID (sub claim)", () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			expect(token.subject).toBe("subject-456");
		});

		test("creates token with single audience (client ID)", () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			expect(token.audience).toBe("client-123");
		});

		test("creates token with multiple audiences", () => {
			let token = AccessToken.generate(
				"https://auth.example.com",
				["https://api.example.com", "https://other.example.com"],
				"subject-456",
			);

			expect(token.audience).toEqual(["https://api.example.com", "https://other.example.com"]);
		});

		test("creates token with scope claim when provided", () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456", [
				"openid",
				"profile",
				"email",
			]);

			expect(token.scope).toBe("openid profile email");
		});

		test("creates token without scope claim when not provided", () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			expect(() => token.scope).toThrow();
		});

		test("creates token with expiry (exp claim)", () => {
			let beforeGeneration = Math.floor(Date.now() / 1000);
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");
			let afterGeneration = Math.floor(Date.now() / 1000);

			let expectedMinExp = beforeGeneration + AccessToken.ttl;
			let expectedMaxExp = afterGeneration + AccessToken.ttl;

			expect(token.expiresIn).toBeGreaterThanOrEqual(expectedMinExp);
			expect(token.expiresIn).toBeLessThanOrEqual(expectedMaxExp);
		});

		test("creates token with issued at (iat claim)", () => {
			let beforeGeneration = Math.floor(Date.now() / 1000);
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");
			let afterGeneration = Math.floor(Date.now() / 1000);

			let issuedAtTimestamp = Math.floor(token.issuedAt.getTime() / 1000);

			expect(issuedAtTimestamp).toBeGreaterThanOrEqual(beforeGeneration);
			expect(issuedAtTimestamp).toBeLessThanOrEqual(afterGeneration);
		});

		test("creates token with not before (nbf claim)", () => {
			let beforeGeneration = Math.floor(Date.now() / 1000);
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");
			let afterGeneration = Math.floor(Date.now() / 1000);

			let nbfTimestamp = Math.floor(token.notBefore.getTime() / 1000);

			expect(nbfTimestamp).toBeGreaterThanOrEqual(beforeGeneration);
			expect(nbfTimestamp).toBeLessThanOrEqual(afterGeneration);
		});

		test("creates token with unique ID (jti claim)", () => {
			let token1 = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");
			let token2 = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			expect(token1.id).toBeDefined();
			expect(token2.id).toBeDefined();
			expect(token1.id).not.toBe(token2.id);
		});
	});

	describe("ttl", () => {
		test("returns TTL in seconds (1 hour)", () => {
			expect(AccessToken.ttl).toBe(3600);
		});

		test("token expiry matches TTL", () => {
			let now = Math.floor(Date.now() / 1000);
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			let expiresIn = token.expiresIn - now;

			// Allow 1 second tolerance for test execution time
			expect(expiresIn).toBeGreaterThanOrEqual(AccessToken.ttl - 1);
			expect(expiresIn).toBeLessThanOrEqual(AccessToken.ttl);
		});
	});

	describe("sign and verify", () => {
		test("signs token and returns valid JWT string", async () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			let signedToken = await token.sign(JWK.Algorithm.ES256, testKeyPair);

			expect(typeof signedToken).toBe("string");
			expect(signedToken.split(".")).toHaveLength(3);
		});

		test("verifies valid signed token and returns claims", async () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456", [
				"openid",
				"profile",
			]);

			let signedToken = await token.sign(JWK.Algorithm.ES256, testKeyPair);
			let verified = await JWT.verify(signedToken, testKeyPair);

			expect(verified).not.toBeNull();
			expect(verified?.payload.sub).toBe("subject-456");
			expect(verified?.payload.aud).toBe("client-123");
			expect(verified?.payload.iss).toBe("https://auth.example.com");
			expect(verified?.payload.scope).toBe("openid profile");
		});

		test("throws for token with invalid signature", async () => {
			let token = AccessToken.generate("https://auth.example.com", "client-123", "subject-456");

			let signedToken = await token.sign(JWK.Algorithm.ES256, testKeyPair);

			// Create a different key pair for verification
			let differentRawKeyPair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
			let differentKeyPair = [await JWK.importKeyPair(differentRawKeyPair)];

			await expect(JWT.verify(signedToken, differentKeyPair)).rejects.toThrow();
		});

		test("throws for expired token", async () => {
			// Create an already-expired token by manipulating the payload directly
			let now = Math.floor(Date.now() / 1000);
			let expiredToken = new AccessToken({
				aud: "client-123",
				exp: now - 3600, // Expired 1 hour ago
				iat: now - 7200, // Issued 2 hours ago
				iss: "https://auth.example.com",
				jti: crypto.randomUUID(),
				nbf: now - 7200,
				sub: "subject-456",
			});

			let signedToken = await expiredToken.sign(JWK.Algorithm.ES256, testKeyPair);

			await expect(JWT.verify(signedToken, testKeyPair)).rejects.toThrow();
		});

		test("throws for token not yet valid (nbf in future)", async () => {
			let now = Math.floor(Date.now() / 1000);
			let futureToken = new AccessToken({
				aud: "client-123",
				exp: now + 7200,
				iat: now,
				iss: "https://auth.example.com",
				jti: crypto.randomUUID(),
				nbf: now + 3600, // Not valid for another hour
				sub: "subject-456",
			});

			let signedToken = await futureToken.sign(JWK.Algorithm.ES256, testKeyPair);

			await expect(JWT.verify(signedToken, testKeyPair)).rejects.toThrow();
		});

		test("throws for malformed JWT string", async () => {
			await expect(JWT.verify("not.a.valid.jwt", testKeyPair)).rejects.toThrow();
		});

		test("throws for completely invalid token", async () => {
			await expect(JWT.verify("invalid-token", testKeyPair)).rejects.toThrow();
		});
	});

	describe("audience", () => {
		test("returns null when audience is not set", () => {
			let token = new AccessToken({
				exp: Math.floor(Date.now() / 1000) + 3600,
				iat: Math.floor(Date.now() / 1000),
				iss: "https://auth.example.com",
				jti: crypto.randomUUID(),
				nbf: Math.floor(Date.now() / 1000),
				sub: "subject-456",
			});

			expect(token.audience).toBeNull();
		});

		test("returns string for single audience", () => {
			let token = new AccessToken({
				aud: "client-123",
				exp: Math.floor(Date.now() / 1000) + 3600,
				iat: Math.floor(Date.now() / 1000),
				iss: "https://auth.example.com",
				jti: crypto.randomUUID(),
				nbf: Math.floor(Date.now() / 1000),
				sub: "subject-456",
			});

			expect(token.audience).toBe("client-123");
		});

		test("returns array for multiple audiences", () => {
			let token = new AccessToken({
				aud: ["client-123", "https://api.example.com"],
				exp: Math.floor(Date.now() / 1000) + 3600,
				iat: Math.floor(Date.now() / 1000),
				iss: "https://auth.example.com",
				jti: crypto.randomUUID(),
				nbf: Math.floor(Date.now() / 1000),
				sub: "subject-456",
			});

			expect(token.audience).toEqual(["client-123", "https://api.example.com"]);
		});
	});

	describe("parsing existing tokens", () => {
		test("parses signed token into AccessToken instance", async () => {
			let originalToken = AccessToken.generate(
				"https://auth.example.com",
				"client-123",
				"subject-456",
				["openid", "profile"],
			);

			let signedToken = await originalToken.sign(JWK.Algorithm.ES256, testKeyPair);
			let verified = await JWT.verify(signedToken, testKeyPair);

			expect(verified).not.toBeNull();

			// Create AccessToken from verified payload
			let parsedToken = new AccessToken(verified!.payload);

			expect(parsedToken.subject).toBe("subject-456");
			expect(parsedToken.audience).toBe("client-123");
			expect(parsedToken.issuer).toBe("https://auth.example.com");
			expect(parsedToken.scope).toBe("openid profile");
			expect(parsedToken.id).toBe(originalToken.id);
		});
	});
});
