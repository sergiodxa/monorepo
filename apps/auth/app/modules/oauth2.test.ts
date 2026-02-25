import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";

import { JWK } from "@edgefirst-dev/jwt";

import { ISSUER } from "../config";
import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";

import { OIDCProvider } from "./oauth2";

// Type helpers for test assertions
interface OIDCTokenResponse {
	access_token: string;
	token_type: "Bearer";
	refresh_token: string;
	expires_in: number;
	id_token: string;
}

// Test fixtures
let testKeyPair: JWK.KeyPair[];
let testSubject = {
	id: "subject-123",
	avatar: "https://example.com/avatar.png",
	username: "testuser",
	displayName: "Test User",
	emailAddress: "test@example.com",
	emailVerifiedAt: new Date(),
};

let testClient = {
	id: "client-123",
	name: "Test Client",
	secret: "client-secret",
	logoutUri: "https://example.com/logout",
	redirectUri: "https://example.com/callback",
};

let testSession = {
	id: "session-123",
	clientId: "client-123",
	subjectId: "subject-123",
	expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
	createdAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
};

let testAuthzCode = {
	clientId: "client-123",
	subjectId: "subject-123",
	sessionId: "session-123",
	pkce: null as { challenge: string; method: "S256" | "plain" } | null,
	nonce: null as string | null,
	scope: ["openid"],
	authTime: Math.floor(Date.now() / 1000),
};

// Mock repository
function createMockRepository(): OIDCProvider.Repository {
	return {
		getSigningKey: mock(async () => testKeyPair),
		findClientById: mock(async (id: string) => (id === testClient.id ? testClient : null)),
		findSessionById: mock(async (id: string) => (id === testSession.id ? testSession : null)),
		findAuthorizationCodeData: mock(async () => testAuthzCode),
		findSubjectById: mock(async (id: string) => (id === testSubject.id ? testSubject : null)),
		deleteSessionBySubjectId: mock(async () => {}),
		deleteSessionById: mock(async () => {}),
		touchSession: mock(async () => {}),
	};
}

beforeAll(async () => {
	let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
	testKeyPair = [await JWK.importKeyPair(rawKeyPair)];
});

afterEach(() => {
	// Reset test fixtures to default state
	testAuthzCode.pkce = null;
	testAuthzCode.nonce = null;
	testAuthzCode.scope = ["openid"];
	testSession.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
});

describe("OAuth2Provider", () => {
	describe("token() - authorization_code grant", () => {
		test("exchanges valid authorization code for tokens", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			expect(result.access_token).toBeDefined();
			expect(result.refresh_token).toBe(testSession.id);
			expect(result.expires_in).toBe(AccessToken.ttl);
			expect(result.id_token).toBeDefined();
		});

		test("rejects invalid authorization code", async () => {
			let repo = createMockRepository();
			repo.findAuthorizationCodeData = mock(async () => {
				throw new Error("Authorization code not found.");
			});
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "invalid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow();
		});

		test("rejects mismatched redirect URI", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: "https://wrong.com/callback",
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDCProvider.InvalidGrantError);
		});

		test("validates PKCE S256 challenge", async () => {
			let codeVerifier = "test-code-verifier-that-is-long-enough";
			// Generate the challenge
			let encoder = new TextEncoder();
			let data = encoder.encode(codeVerifier);
			let hash = await crypto.subtle.digest("SHA-256", data);
			let challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");

			testAuthzCode.pkce = { challenge, method: "S256" };

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				codeVerifier,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			});

			expect(result.access_token).toBeDefined();
		});

		test("rejects missing code_verifier when PKCE required", async () => {
			testAuthzCode.pkce = { challenge: "some-challenge", method: "S256" };

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDCProvider.InvalidRequestError);
		});

		test("rejects expired session", async () => {
			testSession.expiresAt = new Date(Date.now() - 1000); // Expired

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDCProvider.InvalidGrantError);
		});

		test("rejects missing client credentials for confidential client", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});

		test("rejects wrong client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: "wrong-secret",
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});

		test("rejects mismatched client ID", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: "different-client",
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});
	});

	describe("token() - refresh_token grant", () => {
		test("refreshes valid token", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "refresh_token",
				refreshToken: testSession.id,
			})) as OIDCTokenResponse;

			expect(result.access_token).toBeDefined();
			expect(result.refresh_token).toBe(testSession.id);
			expect(result.id_token).toBeDefined();
			expect(repo.touchSession).toHaveBeenCalled();
		});

		test("rejects invalid refresh token", async () => {
			let repo = createMockRepository();
			repo.findSessionById = mock(async () => null);
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "refresh_token",
					refreshToken: "invalid-token",
				}),
			).rejects.toThrow(OIDCProvider.InvalidGrantError);
		});
	});

	describe("token() - client_credentials grant", () => {
		test("issues token for valid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = await provider.token({
				type: "client_credentials",
				clientId: testClient.id,
				clientSecret: testClient.secret,
				resource: ["https://api.example.com"],
			});

			expect(result.access_token).toBeDefined();
			expect(result.expires_in).toBe(AccessToken.ttl);
		});

		test("rejects invalid client secret", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "client_credentials",
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					resource: [],
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});

		test("rejects unknown client", async () => {
			let repo = createMockRepository();
			repo.findClientById = mock(async () => null);
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.token({
					type: "client_credentials",
					clientId: "unknown-client",
					clientSecret: "any-secret",
					resource: [],
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});
	});

	describe("revoke()", () => {
		test("revokes valid refresh token (session)", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await provider.revoke({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: testSession.id,
				tokenTypeHint: "refresh_token",
			});

			expect(repo.deleteSessionById).toHaveBeenCalledWith(testSession.id);
		});

		test("returns success for already-revoked token (per RFC 7009)", async () => {
			let repo = createMockRepository();
			repo.findSessionById = mock(async () => null);
			let provider = new OIDCProvider(ISSUER, repo);

			// Should not throw
			await provider.revoke({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: "already-revoked",
			});
		});

		test("rejects token belonging to different client", async () => {
			let repo = createMockRepository();
			repo.findSessionById = mock(async () => ({
				...testSession,
				clientId: "different-client",
			}));
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.revoke({
					clientId: testClient.id,
					clientSecret: testClient.secret,
					token: testSession.id,
				}),
			).rejects.toThrow(OIDCProvider.UnauthorizedClientError);
		});

		test("rejects invalid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.revoke({
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					token: testSession.id,
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});
	});

	describe("introspect()", () => {
		test("introspects valid refresh token", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: testSession.id,
			});

			expect(result.active).toBe(true);
			if (result.active) {
				expect(result.sub).toBe(testSubject.id);
				expect(result.client_id).toBe(testClient.id);
				expect(result.token_type).toBe("Bearer");
			}
		});

		test("introspects valid access token (JWT)", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			// First get a valid access token
			let tokenResult = await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			});

			// Now introspect it
			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: tokenResult.access_token,
				tokenTypeHint: "access_token",
			});

			expect(result.active).toBe(true);
			if (result.active) {
				expect(result.sub).toBe(testSubject.id);
				expect(result.token_type).toBe("Bearer");
			}
		});

		test("returns inactive for expired/invalid token", async () => {
			let repo = createMockRepository();
			repo.findSessionById = mock(async () => null);
			let provider = new OIDCProvider(ISSUER, repo);

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: "invalid-token",
			});

			expect(result.active).toBe(false);
		});

		test("rejects invalid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(
				provider.introspect({
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					token: testSession.id,
				}),
			).rejects.toThrow(OIDCProvider.InvalidClientError);
		});
	});
});

describe("OIDCProvider", () => {
	describe("userinfo()", () => {
		test("returns user info for valid access token", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			// Get a valid access token
			let tokenResult = await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			});

			let result = await provider.userinfo({
				accessToken: tokenResult.access_token,
			});

			expect(result.subject).toEqual(testSubject);
			expect(result.scope).toContain("openid");
		});
	});

	describe("logout()", () => {
		test("logs out user with valid id_token_hint", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			// Generate a valid ID token
			let idToken = IdToken.generate(
				{
					id: testSubject.id,
					email: testSubject.emailAddress,
					avatar: testSubject.avatar,
					username: testSubject.username,
					displayName: testSubject.displayName,
					emailVerified: true,
				},
				{ id: testClient.id },
			);
			let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, testKeyPair);

			let result = await provider.logout({
				idTokenHint: signedIdToken,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(result.clientId).toBe(testClient.id);
			expect(result.redirectUri).toBe(testClient.logoutUri);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("logs out user with session subject (no id_token_hint)", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = await provider.logout({
				sessionSubject: testSubject.id,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("rejects mismatched client_id and id_token_hint audience", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let idToken = IdToken.generate(
				{
					id: testSubject.id,
					email: testSubject.emailAddress,
					avatar: testSubject.avatar,
					username: testSubject.username,
					displayName: testSubject.displayName,
					emailVerified: true,
				},
				{ id: testClient.id },
			);
			let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, testKeyPair);

			await expect(
				provider.logout({
					idTokenHint: signedIdToken,
					clientId: "different-client",
				}),
			).rejects.toThrow(OIDCProvider.InvalidRequestError);
		});

		test("rejects invalid post_logout_redirect_uri", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let idToken = IdToken.generate(
				{
					id: testSubject.id,
					email: testSubject.emailAddress,
					avatar: testSubject.avatar,
					username: testSubject.username,
					displayName: testSubject.displayName,
					emailVerified: true,
				},
				{ id: testClient.id },
			);
			let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, testKeyPair);

			await expect(
				provider.logout({
					idTokenHint: signedIdToken,
					postLogoutRedirectUri: "https://malicious.com/logout",
				}),
			).rejects.toThrow(OIDCProvider.InvalidRequestError);
		});

		test("requires id_token_hint or session subject", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			await expect(provider.logout({})).rejects.toThrow(OIDCProvider.InvalidRequestError);
		});
	});

	describe("ID Token claims", () => {
		test("includes nonce when provided", async () => {
			testAuthzCode.nonce = "test-nonce-123";

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			let decoded = IdToken.decode(result.id_token);
			expect(decoded.nonce).toBe("test-nonce-123");
		});

		test("includes auth_time claim", async () => {
			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			let decoded = IdToken.decode(result.id_token);
			expect(decoded.authTime).toBeDefined();
			expect(decoded.authTime).toBe(testAuthzCode.authTime);
		});

		test("includes email claims when email scope requested", async () => {
			testAuthzCode.scope = ["openid", "email"];

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			let decoded = IdToken.decode(result.id_token);
			expect(decoded.email).toBe(testSubject.emailAddress);
			expect(decoded.emailVerified).toBe(true);
		});

		test("includes profile claims when profile scope requested", async () => {
			testAuthzCode.scope = ["openid", "profile"];

			let repo = createMockRepository();
			let provider = new OIDCProvider(ISSUER, repo);

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			let decoded = IdToken.decode(result.id_token);
			expect(decoded.name).toBe(testSubject.displayName);
			expect(decoded.username).toBe(testSubject.username);
			expect(decoded.picture).toBe(testSubject.avatar);
		});
	});
});
