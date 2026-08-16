/**
 * Test suite for the OIDC engine. Exercises the token endpoint's three
 * grant types, plus revoke, introspect, userinfo, logout, ID-token claim
 * behavior, and the password login flow — including the upgrade of a hash
 * written under an outdated cost — against a mocked repository.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";

import { Base64Url, Hex, password, randomBytes, sha256 } from "@pkg/crypto";
import { JWK } from "@pkg/jwt";
import { unwrap } from "@pkg/result";

import { OIDC } from "~/app/auth/oidc-provider";
import { ISSUER } from "~/app/config";

// Use the token classes the engine itself signs with
let AccessToken = OIDC.AccessToken;
let IdToken = OIDC.IdToken;

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
function createMockRepository(): OIDC.Repository {
	return {
		getSigningKey: mock(async () => testKeyPair),
		findClientById: mock(async (id: string) => (id === testClient.id ? testClient : null)),
		findClientByLogoutUri: mock(async (uri: string) =>
			uri === testClient.logoutUri ? testClient : null,
		),
		findSessionById: mock(async (id: string) => (id === testSession.id ? testSession : null)),
		findAuthorizationCodeData: mock(async () => testAuthzCode),
		findSubjectById: mock(async (id: string) => (id === testSubject.id ? testSubject : null)),
		deleteSessionBySubjectId: mock(async () => {}),
		deleteSessionById: mock(async () => {}),
		touchSession: mock(async () => {}),
		findSessionsForBackchannelLogout: mock(async () => [] as OIDC.SessionWithClient[]),
		findSessionsForFrontchannelLogout: mock(async () => [] as OIDC.SessionWithClient[]),
	} as unknown as OIDC.Repository;
}

beforeAll(async () => {
	let rawKeyPair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: "https://wrong.com/callback",
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDC.InvalidGrantError);
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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDC.InvalidRequestError);
		});

		test("rejects expired session", async () => {
			testSession.expiresAt = new Date(Date.now() - 1000); // Expired

			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDC.InvalidGrantError);
		});

		test("rejects missing client credentials for confidential client", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});

		test("rejects wrong client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: testClient.id,
					clientSecret: "wrong-secret",
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});

		test("rejects mismatched client ID", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "authorization_code",
					code: "valid-code",
					redirectUri: testClient.redirectUri,
					clientId: "different-client",
					clientSecret: testClient.secret,
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});
	});

	describe("token() - refresh_token grant", () => {
		test("refreshes valid token", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "refresh_token",
					refreshToken: "invalid-token",
				}),
			).rejects.toThrow(OIDC.InvalidGrantError);
		});
	});

	describe("token() - client_credentials grant", () => {
		test("issues token for valid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "client_credentials",
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					resource: [],
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});

		test("rejects unknown client", async () => {
			let repo = createMockRepository();
			repo.findClientById = mock(async () => null);
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.token({
					type: "client_credentials",
					clientId: "unknown-client",
					clientSecret: "any-secret",
					resource: [],
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});
	});

	describe("revoke()", () => {
		test("revokes valid refresh token (session)", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.revoke({
					clientId: testClient.id,
					clientSecret: testClient.secret,
					token: testSession.id,
				}),
			).rejects.toThrow(OIDC.UnauthorizedClientError);
		});

		test("rejects invalid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.revoke({
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					token: testSession.id,
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});
	});

	describe("introspect()", () => {
		test("introspects valid refresh token", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: "invalid-token",
			});

			expect(result.active).toBe(false);
		});

		test("rejects invalid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(
				provider.introspect({
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					token: testSession.id,
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});
	});
});

describe("OIDC", () => {
	describe("userinfo()", () => {
		test("returns user info for valid access token", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, testKeyPair);

			let result = await provider.logout({
				idTokenHint: signedIdToken,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(result.clientId).toBe(testClient.id);
			expect(result.redirectUri).toBe(testClient.logoutUri);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("accepts an expired id_token_hint", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			// The ordinary case: somebody comes back after their ID token aged out and asks
			// to be signed out. The hint identifies the session, so an expired one still
			// answers the only question being asked of it.
			let expiredAt = Math.floor(Date.now() / 1000) - 60 * 60;
			let idToken = new IdToken({
				sub: testSubject.id,
				iss: ISSUER,
				aud: testClient.id,
				jti: crypto.randomUUID(),
				iat: expiredAt - 60,
				exp: expiredAt,
			});
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, testKeyPair);

			let result = await provider.logout({
				idTokenHint: signedIdToken,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(result.clientId).toBe(testClient.id);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("rejects an id_token_hint this server did not sign", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			let otherKeyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
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
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, otherKeyPair);

			await expect(provider.logout({ idTokenHint: signedIdToken })).rejects.toThrow(
				OIDC.InvalidRequestError,
			);

			expect(repo.deleteSessionBySubjectId).not.toHaveBeenCalled();
		});

		test("rejects an id_token_hint issued by somebody else", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			let idToken = new IdToken({
				sub: testSubject.id,
				iss: "https://elsewhere.example.com",
				aud: testClient.id,
				jti: crypto.randomUUID(),
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 600,
			});
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, testKeyPair);

			await expect(provider.logout({ idTokenHint: signedIdToken })).rejects.toThrow(
				OIDC.InvalidRequestError,
			);

			expect(repo.deleteSessionBySubjectId).not.toHaveBeenCalled();
		});

		test("rejects a malformed id_token_hint", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(provider.logout({ idTokenHint: "not-a-jwt" })).rejects.toThrow(
				OIDC.InvalidRequestError,
			);

			expect(repo.deleteSessionBySubjectId).not.toHaveBeenCalled();
		});

		test("logs out user with session subject (no id_token_hint)", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			let result = await provider.logout({
				sessionSubject: testSubject.id,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("rejects mismatched client_id and id_token_hint audience", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, testKeyPair);

			await expect(
				provider.logout({
					idTokenHint: signedIdToken,
					clientId: "different-client",
				}),
			).rejects.toThrow(OIDC.InvalidRequestError);
		});

		test("drops an unregistered post_logout_redirect_uri but still logs out", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, testKeyPair);

			let result = await provider.logout({
				idTokenHint: signedIdToken,
				postLogoutRedirectUri: "https://malicious.com/logout",
			});

			// The address never becomes a destination, which is what keeps the endpoint
			// from being an open redirect; the sign-out that was asked for still happens.
			expect(result.redirectUri).toBeUndefined();
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("requires id_token_hint or session subject", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			await expect(provider.logout({})).rejects.toThrow(OIDC.InvalidRequestError);
		});

		test("honors a registered post_logout_redirect_uri with no hint and no client_id", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			// Nothing identifies a client, so the address is checked against the registered
			// logout URIs directly. Exactly one client registered it, so it is a destination
			// this server nominated and the redirect is legitimate.
			let result = await provider.logout({
				sessionSubject: testSubject.id,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.redirectUri).toBe(testClient.logoutUri);
			expect(repo.findClientByLogoutUri).toHaveBeenCalledWith(testClient.logoutUri);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("drops an unregistered post_logout_redirect_uri when no client is identified", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			// Neither an id_token_hint nor a client_id, and no client registered this
			// address: honoring it would make the endpoint an open redirect, so it is
			// dropped — but the session still ends.
			let result = await provider.logout({
				sessionSubject: testSubject.id,
				postLogoutRedirectUri: "https://malicious.com/logout",
			});

			expect(result.redirectUri).toBeUndefined();
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("does not exclude the client that merely registered the redirect from the fan-out", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

			// The address was matched against a registration, which says nothing about who
			// started the logout — so no relying party is dropped from the notification.
			let result = await provider.logout({
				sessionSubject: testSubject.id,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.clientId).toBeUndefined();
			expect(repo.findSessionsForBackchannelLogout).toHaveBeenCalledWith(testSubject.id, undefined);
			expect(repo.findSessionsForFrontchannelLogout).toHaveBeenCalledWith(
				testSubject.id,
				undefined,
			);
		});

		test("collects the logout fan-out before the sessions are deleted", async () => {
			let repo = createMockRepository();
			let target: OIDC.SessionWithClient = {
				sessionId: "session-1",
				clientId: "other-client",
				backchannelLogoutUri: "https://other.example.com/backchannel",
				backchannelLogoutSessionRequired: "true",
				frontchannelLogoutUri: "https://other.example.com/frontchannel",
				frontchannelLogoutSessionRequired: "true",
			};

			// The recipient list is derived from the very rows logout deletes, so a
			// repository that stops answering once they are gone is exactly what
			// production looks like.
			let deleted = false;
			repo.deleteSessionBySubjectId = mock(async () => {
				deleted = true;
			});
			repo.findSessionsForBackchannelLogout = mock(async () => (deleted ? [] : [target]));
			repo.findSessionsForFrontchannelLogout = mock(async () => (deleted ? [] : [target]));

			let provider = new OIDC(ISSUER, repo);
			let result = await provider.logout({ sessionSubject: testSubject.id });

			expect(result.backchannelSessions).toEqual([target]);
			expect(result.frontchannelUrls).toEqual([
				{
					clientId: "other-client",
					url: `https://other.example.com/frontchannel?iss=https%3A%2F%2F${ISSUER}&sid=session-1`,
				},
			]);
			expect(deleted).toBe(true);
		});

		test("does not fail the logout when the back channel cannot be delivered", async () => {
			let repo = createMockRepository();
			let target: OIDC.SessionWithClient = {
				sessionId: "session-1",
				clientId: "other-client",
				backchannelLogoutUri: "https://other.example.com/backchannel",
				backchannelLogoutSessionRequired: "true",
				frontchannelLogoutUri: null,
				frontchannelLogoutSessionRequired: "false",
			};

			// The sign-out already happened by the time delivery is attempted, so nothing
			// that goes wrong here — down to not being able to sign the tokens at all — may
			// turn it into a failure the person sees.
			repo.getSigningKey = mock(async () => {
				throw new Error("key store unavailable");
			});

			let provider = new OIDC(ISSUER, repo);

			expect(
				await provider.deliverBackchannelLogoutTokens(testSubject.id, [target]),
			).toBeUndefined();
		});
	});

	describe("ID Token claims", () => {
		test("includes nonce when provided", async () => {
			testAuthzCode.nonce = "test-nonce-123";

			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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
			let provider = new OIDC(ISSUER, repo);

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

// =============================================================================
// Password login and hash migration
// =============================================================================

/** Password every credential login case signs in with. */
const LOGIN_PASSWORD = "correct horse battery staple";

/** Prefix the self-describing PBKDF2 format writes, used to recognize a stored hash. */
const PBKDF2_PREFIX = "$pbkdf2-sha256$";

/** Iteration count standing in for a hash written before the current cost policy. */
const OUTDATED_ITERATIONS = 1_000;

/** Salt length, in bytes, the encoded format is built with. */
const SALT_BYTES = 16;

/** Derived key length, in bytes, the encoded format is built with. */
const KEY_BYTES = 32;

/** Bits per byte, to turn the key length into a `deriveBits` length. */
const BITS_PER_BYTE = 8;

/**
 * Hashes a password at an outdated iteration count, standing in for a credential
 * stored before the current cost policy and therefore due for an upgrade on login.
 *
 * @param secret - Plaintext password to hash.
 * @returns An encoded PBKDF2 hash that verifies but reports as needing a rehash.
 */
async function outdatedHash(secret: string): Promise<string> {
	let salt = randomBytes(SALT_BYTES);

	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	let bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: OUTDATED_ITERATIONS, hash: "SHA-256" },
		key,
		KEY_BYTES * BITS_PER_BYTE,
	);

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(new Uint8Array(bits));

	return `${PBKDF2_PREFIX}i=${OUTDATED_ITERATIONS}$${encodedSalt}$${encodedKey}`;
}

/** Mutable record of what a login repository double holds and was asked to persist. */
interface LoginRepositoryState {
	/** Hash currently stored for the subject, or `null` when they have no credential. */
	storedHash: string | null;
	/** Verification timestamp on the stored credential; `null` blocks sign-in. */
	verifiedAt: Date | null;
	/** Hashes handed to `createCredential`, in call order. */
	created: string[];
	/** Verification instants handed to `createCredential`, in call order. */
	createdVerifiedAt: (Date | null)[];
	/** Hashes handed to `updateCredentialPasswordHash`, in call order. */
	upgraded: string[];
	/** Avatar URLs handed to `createSubject`, in call order. */
	avatars: string[];
	/** When set, `updateCredentialPasswordHash` rejects with it. */
	upgradeError: Error | null;
	/** When true, the email looks unregistered and the sign-up branch runs. */
	subjectMissing: boolean;
}

/** Builds login repository state, defaulting to a verified subject with no credential yet. */
function loginState(overrides: Partial<LoginRepositoryState> = {}): LoginRepositoryState {
	return {
		storedHash: null,
		verifiedAt: new Date(),
		created: [],
		createdVerifiedAt: [],
		upgraded: [],
		avatars: [],
		upgradeError: null,
		subjectMissing: false,
		...overrides,
	};
}

/**
 * Repository double for the password login flow, reading and recording through the
 * given state so a test can assert what was persisted rather than how it was called.
 */
function createLoginRepository(state: LoginRepositoryState): OIDC.Repository {
	return {
		...createMockRepository(),

		findSubjectByEmail: mock(async () => (state.subjectMissing ? null : testSubject)),

		createSubject: mock(async (data: { avatar: string }) => {
			state.avatars.push(data.avatar);
			return testSubject;
		}),

		findCredential: mock(async () => {
			if (state.storedHash === null) return null;
			return {
				subjectId: testSubject.id,
				passwordHash: state.storedHash,
				verifiedAt: state.verifiedAt,
			};
		}),

		createCredential: mock(
			async (_subjectId: string, passwordHash: string, verifiedAt: Date | null) => {
				state.created.push(passwordHash);
				state.createdVerifiedAt.push(verifiedAt);
			},
		),

		updateCredentialPasswordHash: mock(async (_subjectId: string, passwordHash: string) => {
			if (state.upgradeError) throw state.upgradeError;
			state.upgraded.push(passwordHash);
		}),

		createSession: mock(async () => ({ id: testSession.id })),

		findOrCreateGrant: mock(async () => ({
			id: "grant-123",
			subjectId: testSubject.id,
			clientId: testClient.id,
		})),

		storeAuthorizationCode: mock(async () => {}),
	} as unknown as OIDC.Repository;
}

/** Builds a credential login input, with the authorization request the flow resumes. */
function loginInput(
	overrides: Partial<OIDC.LoginWithCredentialInput> = {},
): OIDC.LoginWithCredentialInput {
	return {
		email: testSubject.emailAddress,
		password: LOGIN_PASSWORD,
		name: testSubject.displayName,
		username: testSubject.username,
		clientId: testClient.id,
		ip: null,
		ua: null,
		redirectUri: testClient.redirectUri,
		state: "state-123",
		...overrides,
	};
}

describe("loginWithCredential()", () => {
	test("authenticates a subject whose stored hash is behind the current cost policy", async () => {
		let state = loginState({ storedHash: await outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
	});

	test("upgrades an outdated hash to the current policy after a successful sign-in", async () => {
		let state = loginState({ storedHash: await outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		await provider.loginWithCredential(loginInput());

		expect(state.upgraded).toHaveLength(1);

		let upgraded = state.upgraded[0] ?? "";
		expect(upgraded.startsWith(PBKDF2_PREFIX)).toBe(true);
		expect(password.needsRehash(upgraded)).toBe(false);
		expect(unwrap(await password.verify(upgraded, LOGIN_PASSWORD))).toBe(true);
	});

	test("verifies against the upgraded hash on the next sign-in, without upgrading again", async () => {
		let state = loginState({ storedHash: await outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		await provider.loginWithCredential(loginInput());
		state.storedHash = state.upgraded[0] ?? null;
		state.upgraded = [];

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		expect(state.upgraded).toHaveLength(0);
	});

	test("rejects a wrong password against an outdated hash and leaves it alone", async () => {
		let state = loginState({ storedHash: await outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput({ password: "wrong password" }));

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
		expect(state.upgraded).toHaveLength(0);
	});

	test("rejects a wrong password against a PBKDF2 hash", async () => {
		let state = loginState({ storedHash: unwrap(await password.hash(LOGIN_PASSWORD)) });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput({ password: "wrong password" }));

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
	});

	test("refuses a hash it cannot read instead of letting the sign-in through", async () => {
		let state = loginState({ storedHash: "not-a-hash-at-all" });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
	});

	test("still signs the subject in when persisting the upgrade fails", async () => {
		let state = loginState({
			storedHash: await outdatedHash(LOGIN_PASSWORD),
			upgradeError: new Error("database unavailable"),
		});
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		expect(state.upgraded).toHaveLength(0);
	});

	test("refuses an unverified credential without checking the password", async () => {
		let state = loginState({
			storedHash: await outdatedHash(LOGIN_PASSWORD),
			verifiedAt: null,
		});
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure")
			expect(result.error).toBeInstanceOf(OIDC.MissingValidationError);
		expect(state.upgraded).toHaveLength(0);
	});

	test("writes a PBKDF2 hash when the subject has no credential yet, and refuses the sign-in", async () => {
		let state = loginState();
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure")
			expect(result.error).toBeInstanceOf(OIDC.MissingValidationError);
		expect(state.created).toHaveLength(1);
		expect((state.created[0] ?? "").startsWith(PBKDF2_PREFIX)).toBe(true);
	});

	test("stores that hash unverified, so a stranger cannot password-protect somebody else's account", async () => {
		let state = loginState();
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		await provider.loginWithCredential(loginInput());

		expect(state.createdVerifiedAt).toEqual([null]);
	});

	test("gives a brand-new subject a hex-digest gravatar and a PBKDF2 credential", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		await provider.loginWithCredential(loginInput());

		let expectedDigest = Hex.encode(unwrap(await sha256(testSubject.emailAddress)));
		expect(state.avatars).toEqual([`https://gravatar.com/avatar/${expectedDigest}`]);
		expect((state.created[0] ?? "").startsWith(PBKDF2_PREFIX)).toBe(true);
	});

	test("registers an unknown email and answers with a code instead of refusing it", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		if (result.status === "success") expect(result.data.params.code).toBeTruthy();
	});

	test("registers the credential verified, so the account it just created can sign in", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state));

		await provider.loginWithCredential(loginInput());

		expect(state.createdVerifiedAt).toHaveLength(1);
		expect(state.createdVerifiedAt[0]).toBeInstanceOf(Date);

		// The registration's own hash is now what is stored, and signing in again with
		// the same password has to succeed: this is the loop the null column broke.
		state.storedHash = state.created[0] ?? null;
		state.verifiedAt = state.createdVerifiedAt[0] ?? null;
		state.subjectMissing = false;

		let signIn = await provider.loginWithCredential(loginInput());

		expect(signIn.status).toBe("success");
	});
});
