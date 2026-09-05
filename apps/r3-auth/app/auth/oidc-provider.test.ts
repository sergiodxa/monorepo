/**
 * Test suite for the OIDC engine. Exercises the token endpoint's three
 * grant types, plus revoke, introspect, userinfo, logout, ID-token claim
 * behavior, the RFC 9068 claims of the access tokens it mints, and the password
 * login flow — including the upgrade of a hash written under an outdated cost —
 * against a mocked repository.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scryptSync } from "node:crypto";

import { Base64Url, Hex, password, randomBytes, sha256 } from "@sdxc/crypto";
import { JWK } from "@sdxc/jwt";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { OIDC } from "~/app/auth/oidc-provider";
import LogoutToken from "~/app/auth/values/logout-token";
import { ISSUER } from "~/app/config";

let AccessToken = OIDC.AccessToken;
let IdToken = OIDC.IdToken;

interface OIDCTokenResponse {
	access_token: string;
	token_type: "Bearer";
	refresh_token: string;
	expires_in: number;
	id_token: string;
}

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
	expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
	createdAt: new Date(Date.now() - 60 * 1000),
	scope: ["openid"],
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

/**
 * The engine's repository with every member restated as a function property, so a
 * test can hold the mock itself (`repo.touchSession`) and assert on it.
 */
type MockRepository = { [Key in keyof OIDC.Repository]: OIDC.Repository[Key] };

function createMockRepository(): MockRepository {
	return {
		getSigningKey: vi.fn(async () => testKeyPair),
		findClientById: vi.fn(async (id: string) => (id === testClient.id ? testClient : null)),
		findClientByLogoutUri: vi.fn(async (uri: string) =>
			uri === testClient.logoutUri ? testClient : null,
		),
		findSessionById: vi.fn(async (id: string) => (id === testSession.id ? testSession : null)),
		findAuthorizationCodeData: vi.fn(async () => testAuthzCode),
		findSubjectById: vi.fn(async (id: string) => (id === testSubject.id ? testSubject : null)),
		deleteSessionBySubjectId: vi.fn(async () => {}),
		deleteSessionById: vi.fn(async () => {}),
		touchSession: vi.fn(async () => {}),
		findSessionsForBackchannelLogout: vi.fn(async () => [] as OIDC.SessionWithClient[]),
		findSessionsForFrontchannelLogout: vi.fn(async () => [] as OIDC.SessionWithClient[]),
	} as unknown as MockRepository;
}

/**
 * Log double for the engine, recording every reported failure so a test can assert a
 * recovery the engine made on its own was surfaced rather than swallowed.
 */
function createMockLog() {
	return { warn: vi.fn() };
}

/** A relying party whose back-channel endpoint accepts the token it is sent. */
const HEALTHY_BACKCHANNEL = "https://healthy.example.com/backchannel-logout";

/** A relying party whose back-channel endpoint answers, and answers with a server error. */
const REFUSING_BACKCHANNEL = "https://refusing.example.com/backchannel-logout";

/** A relying party whose back-channel endpoint the request never reaches. */
const UNREACHABLE_BACKCHANNEL = "https://unreachable.example.com/backchannel-logout";

let server = setupServer();

/**
 * A session ready for the logout fan-out, with session-specific logout on so the token
 * carries the same `sid` a production recipient asking for one would receive.
 *
 * @param clientId - The relying party being notified.
 * @param backchannelLogoutUri - Endpoint the logout token is posted to.
 */
function backchannelSession(clientId: string, backchannelLogoutUri: string) {
	return {
		sessionId: `session-${clientId}`,
		clientId,
		backchannelLogoutUri,
		backchannelLogoutSessionRequired: "true",
		frontchannelLogoutUri: null,
		frontchannelLogoutSessionRequired: "false",
	} satisfies OIDC.SessionWithClient;
}

beforeAll(async () => {
	let rawKeyPair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	testKeyPair = [await JWK.importKeyPair(rawKeyPair)];
	server.listen({ onUnhandledRequest: "error" });
});

afterAll(() => server.close());

afterEach(() => {
	server.resetHandlers();
	testAuthzCode.pkce = null;
	testAuthzCode.nonce = null;
	testAuthzCode.scope = ["openid"];
	testSession.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
});

describe("OAuth2Provider", () => {
	describe("token() - authorization_code grant", () => {
		/**
		 * The refresh token a redeemed code carries **is** the session id, which is what
		 * revocation and the account area's device list are built on. `offline_access` is
		 * what asks for it, so the exchange proving the identity has to request it.
		 */
		test("exchanges valid authorization code for tokens", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			testAuthzCode.scope = ["openid", "offline_access"];

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

		test("issues an access token carrying the RFC 9068 claims", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = (await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			})) as OIDCTokenResponse;

			let decoded = AccessToken.decode(result.access_token);

			expect(decoded.issuer).toBe(ISSUER);
			expect(decoded.subject).toBe(testSubject.id);
			expect(decoded.clientId).toBe(testClient.id);
			expect(decoded.audience).toBe(testClient.id);
			expect(decoded.scopes).toEqual(["openid"]);
			expect(decoded.id).toBeDefined();
		});

		test("rejects invalid authorization code", async () => {
			let repo = createMockRepository();
			repo.findAuthorizationCodeData = vi.fn(async () => {
				throw new Error("Authorization code not found.");
			});
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let encoder = new TextEncoder();
			let data = encoder.encode(codeVerifier);
			let hash = await crypto.subtle.digest("SHA-256", data);
			let challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");

			testAuthzCode.pkce = { challenge, method: "S256" };

			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

		/**
		 * A digest the runtime refuses is this server failing, so reporting a mismatch would
		 * accuse the client of forging a verifier it in fact presented correctly.
		 */
		test("reports a refused digest as a server failure rather than a PKCE mismatch", async () => {
			testAuthzCode.pkce = { challenge: "some-challenge", method: "S256" };

			let repo = createMockRepository();
			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			let digest = vi
				.spyOn(crypto.subtle, "digest")
				.mockRejectedValue(new Error("digest unavailable"));

			try {
				await expect(
					provider.token({
						type: "authorization_code",
						code: "valid-code",
						redirectUri: testClient.redirectUri,
						clientId: testClient.id,
						clientSecret: testClient.secret,
						codeVerifier: "test-code-verifier-that-is-long-enough",
					}),
				).rejects.toThrow(OIDC.InternalServerError);
			} finally {
				digest.mockRestore();
			}

			expect(log.warn).toHaveBeenCalledWith("oidc.token.pkce_digest_failed", {
				clientId: testClient.id,
				error: expect.any(String),
			});
		});

		test("rejects expired session", async () => {
			testSession.expiresAt = new Date(Date.now() - 1000);

			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = (await provider.token({
				type: "refresh_token",
				refreshToken: testSession.id,
			})) as OIDCTokenResponse;

			expect(result.access_token).toBeDefined();
			expect(result.refresh_token).toBe(testSession.id);
			expect(result.id_token).toBeDefined();
			expect(repo.touchSession).toHaveBeenCalled();
		});

		test("issues an access token naming the session's client", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = (await provider.token({
				type: "refresh_token",
				refreshToken: testSession.id,
			})) as OIDCTokenResponse;

			let decoded = AccessToken.decode(result.access_token);

			expect(decoded.subject).toBe(testSession.subjectId);
			expect(decoded.clientId).toBe(testSession.clientId);
			expect(decoded.audience).toBe(testSession.clientId);
		});

		test("rejects invalid refresh token", async () => {
			let repo = createMockRepository();
			repo.findSessionById = vi.fn(async () => null);
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.token({
				type: "client_credentials",
				clientId: testClient.id,
				clientSecret: testClient.secret,
				resource: ["https://api.example.com"],
			});

			expect(result.access_token).toBeDefined();
			expect(result.expires_in).toBe(AccessToken.ttl);
		});

		test("issues a service token whose subject is the client itself", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.token({
				type: "client_credentials",
				clientId: testClient.id,
				clientSecret: testClient.secret,
				resource: ["https://api.example.com"],
			});

			let decoded = AccessToken.decode(result.access_token);

			expect(decoded.clientId).toBe(testClient.id);
			expect(decoded.subject).toBe(decoded.clientId);
			expect(decoded.audience).toEqual([ISSUER, "https://api.example.com"]);
			expect(decoded.scopes).toEqual([]);
		});

		test("rejects invalid client secret", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			repo.findClientById = vi.fn(async () => null);
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			repo.findSessionById = vi.fn(async () => null);
			let provider = new OIDC(ISSUER, repo, createMockLog());

			await provider.revoke({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: "already-revoked",
			});
		});

		test("rejects token belonging to different client", async () => {
			let repo = createMockRepository();
			repo.findSessionById = vi.fn(async () => ({
				...testSession,
				clientId: "different-client",
			}));
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let tokenResult = await provider.token({
				type: "authorization_code",
				code: "valid-code",
				redirectUri: testClient.redirectUri,
				clientId: testClient.id,
				clientSecret: testClient.secret,
			});

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: tokenResult.access_token,
				tokenTypeHint: "access_token",
			});

			expect(result.active).toBe(true);
			if (result.active) {
				expect(result.sub).toBe(testSubject.id);
				expect(result.client_id).toBe(testClient.id);
				expect(result.aud).toBe(testClient.id);
				expect(result.token_type).toBe("Bearer");
			}
		});

		test("introspects a client_credentials access token", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let tokenResult = await provider.token({
				type: "client_credentials",
				clientId: testClient.id,
				clientSecret: testClient.secret,
				resource: ["https://api.example.com"],
			});

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: tokenResult.access_token,
				tokenTypeHint: "access_token",
			});

			expect(result.active).toBe(true);
			if (result.active) {
				expect(result.client_id).toBe(testClient.id);
				expect(result.aud).toEqual([ISSUER, "https://api.example.com"]);
			}
		});

		test("keeps a token minted before the client_id claim active", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let now = Math.floor(Date.now() / 1000);
			let legacyToken = await new AccessToken({
				aud: testClient.id,
				exp: now + AccessToken.ttl,
				iat: now,
				iss: ISSUER,
				jti: crypto.randomUUID(),
				sub: testSubject.id,
			}).sign(JWK.Algorithm.ES256, testKeyPair);

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: legacyToken,
				tokenTypeHint: "access_token",
			});

			expect(result.active).toBe(true);
			if (result.active) expect(result.client_id).toBeUndefined();
		});

		test("returns inactive for expired/invalid token", async () => {
			let repo = createMockRepository();
			repo.findSessionById = vi.fn(async () => null);
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.introspect({
				clientId: testClient.id,
				clientSecret: testClient.secret,
				token: "invalid-token",
			});

			expect(result.active).toBe(false);
		});

		test("rejects invalid client credentials", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			await expect(
				provider.introspect({
					clientId: testClient.id,
					clientSecret: "wrong-secret",
					token: testSession.id,
				}),
			).rejects.toThrow(OIDC.InvalidClientError);
		});

		/**
		 * A key store that cannot answer knows nothing about the token, so introspection
		 * reports its own failure rather than asserting a live token is dead.
		 */
		test("reports a signing-key failure rather than calling the token inactive", async () => {
			let repo = createMockRepository();
			repo.getSigningKey = vi.fn(async () => {
				throw new Error("key store unavailable");
			});

			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			await expect(
				provider.introspect({
					clientId: testClient.id,
					clientSecret: testClient.secret,
					token: "an-access-token",
					tokenTypeHint: "access_token",
				}),
			).rejects.toThrow(OIDC.InternalServerError);

			expect(log.warn).toHaveBeenCalledWith("oidc.introspect.signing_key_failed", {
				clientId: testClient.id,
				error: "key store unavailable",
			});
		});
	});
});

describe("OIDC", () => {
	describe("userinfo()", () => {
		test("returns user info for valid access token", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

		/**
		 * The hint identifies the session, which is the only question asked of it, so a
		 * token that has aged out still answers it.
		 */
		test("accepts an expired id_token_hint", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

			await expect(provider.logout({ idTokenHint: "not-a-jwt" })).rejects.toThrow(
				OIDC.InvalidRequestError,
			);

			expect(repo.deleteSessionBySubjectId).not.toHaveBeenCalled();
		});

		test("logs out user with session subject (no id_token_hint)", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.logout({
				sessionSubject: testSubject.id,
			});

			expect(result.subjectId).toBe(testSubject.id);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("rejects mismatched client_id and id_token_hint audience", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

		/**
		 * Only a registered address becomes a destination, which is what keeps the
		 * endpoint from being an open redirect; the sign-out asked for still happens.
		 */
		test("drops an unregistered post_logout_redirect_uri but still logs out", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

			expect(result.redirectUri).toBeUndefined();
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		test("requires id_token_hint or session subject", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			await expect(provider.logout({})).rejects.toThrow(OIDC.InvalidRequestError);
		});

		/**
		 * With nothing to identify a client, the address is checked against the registered
		 * logout URIs directly; a match means this server nominated the destination.
		 */
		test("honors a registered post_logout_redirect_uri with no hint and no client_id", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.logout({
				sessionSubject: testSubject.id,
				postLogoutRedirectUri: testClient.logoutUri,
			});

			expect(result.redirectUri).toBe(testClient.logoutUri);
			expect(repo.findClientByLogoutUri).toHaveBeenCalledWith(testClient.logoutUri);
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		/**
		 * An address no client registered would make the endpoint an open redirect, so it
		 * is dropped while the session still ends.
		 */
		test("drops an unregistered post_logout_redirect_uri when no client is identified", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

			let result = await provider.logout({
				sessionSubject: testSubject.id,
				postLogoutRedirectUri: "https://malicious.com/logout",
			});

			expect(result.redirectUri).toBeUndefined();
			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		/**
		 * Matching the address against a registration says nothing about who started the
		 * logout, so every relying party stays in the notification.
		 */
		test("does not exclude the client that merely registered the redirect from the fan-out", async () => {
			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

		/**
		 * The recipient list is derived from the very rows logout deletes, so a repository
		 * that stops answering once they are gone matches production.
		 */
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

			let deleted = false;
			repo.deleteSessionBySubjectId = vi.fn(async () => {
				deleted = true;
			});
			repo.findSessionsForBackchannelLogout = vi.fn(async () => (deleted ? [] : [target]));
			repo.findSessionsForFrontchannelLogout = vi.fn(async () => (deleted ? [] : [target]));

			let provider = new OIDC(ISSUER, repo, createMockLog());
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

		/**
		 * The sign-out has already happened by the time delivery is attempted, so a key
		 * store that cannot sign the tokens leaves the sign-out complete regardless.
		 */
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

			repo.getSigningKey = vi.fn(async () => {
				throw new Error("key store unavailable");
			});

			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			expect(
				await provider.deliverBackchannelLogoutTokens(testSubject.id, [target]),
			).toBeUndefined();

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.backchannel_signing_failed", {
				subjectId: testSubject.id,
				recipient_count: 1,
				error: "key store unavailable",
			});
		});

		/**
		 * A relying party that answered and refused the token and one the request never
		 * reached are separate diagnoses, reported under their own events; either one leaves
		 * the healthy relying parties logged out and the sign-out complete.
		 */
		test("reports every back-channel delivery failure and still delivers to the healthy clients", async () => {
			let delivered: string[] = [];

			server.use(
				http.post(HEALTHY_BACKCHANNEL, async ({ request }) => {
					let body = new URLSearchParams(await request.text());
					delivered.push(body.get("logout_token") ?? "");
					return new HttpResponse(null, { status: 200 });
				}),
				http.post(REFUSING_BACKCHANNEL, () => new HttpResponse(null, { status: 500 })),
				http.post(UNREACHABLE_BACKCHANNEL, () => HttpResponse.error()),
			);

			let log = createMockLog();
			let provider = new OIDC(ISSUER, createMockRepository(), log);

			expect(
				await provider.deliverBackchannelLogoutTokens(testSubject.id, [
					backchannelSession("refusing-client", REFUSING_BACKCHANNEL),
					backchannelSession("unreachable-client", UNREACHABLE_BACKCHANNEL),
					backchannelSession("healthy-client", HEALTHY_BACKCHANNEL),
				]),
			).toBeUndefined();

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.backchannel_refused", {
				subjectId: testSubject.id,
				clientId: "refusing-client",
				host: "refusing.example.com",
				status: 500,
			});

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.backchannel_unreachable", {
				subjectId: testSubject.id,
				clientId: "unreachable-client",
				host: "unreachable.example.com",
				error: expect.any(String),
			});

			expect(log.warn).toHaveBeenCalledTimes(2);

			expect(delivered).toHaveLength(1);

			let token = LogoutToken.decode(delivered[0] as string);
			expect(token.audience).toBe("healthy-client");
			expect(token.subject).toBe(testSubject.id);
			expect(token.sessionId).toBe("session-healthy-client");
		});

		/**
		 * A hint that every client starts failing to present, as happens once a signing key
		 * is retired, is legible only in the recorded reason behind the one answer sent.
		 */
		test("records why an id_token_hint was refused", async () => {
			let repo = createMockRepository();
			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			await expect(
				provider.logout({ idTokenHint: "not-a-jwt", clientId: testClient.id }),
			).rejects.toThrow(OIDC.InvalidRequestError);

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.hint_verification_failed", {
				clientId: testClient.id,
				error: expect.any(String),
			});
		});

		/**
		 * A stored logout address that no longer parses belongs to one relying party, so
		 * the sign-out completes and every other party still receives its iframe.
		 */
		test("skips a client whose stored front-channel logout URI no longer parses", async () => {
			let repo = createMockRepository();

			let broken: OIDC.SessionWithClient = {
				sessionId: "session-broken",
				clientId: "broken-client",
				backchannelLogoutUri: null,
				backchannelLogoutSessionRequired: "false",
				frontchannelLogoutUri: "not a url",
				frontchannelLogoutSessionRequired: "false",
			};

			let healthy: OIDC.SessionWithClient = {
				sessionId: "session-healthy",
				clientId: "healthy-client",
				backchannelLogoutUri: null,
				backchannelLogoutSessionRequired: "false",
				frontchannelLogoutUri: "https://healthy.example.com/frontchannel",
				frontchannelLogoutSessionRequired: "true",
			};

			repo.findSessionsForFrontchannelLogout = vi.fn(async () => [broken, healthy]);

			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			let result = await provider.logout({ sessionSubject: testSubject.id });

			expect(result.frontchannelUrls).toEqual([
				{
					clientId: "healthy-client",
					url: `https://healthy.example.com/frontchannel?iss=https%3A%2F%2F${ISSUER}&sid=session-healthy`,
				},
			]);

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.frontchannel_uri_invalid", {
				clientId: "broken-client",
				error: expect.any(String),
			});

			expect(repo.deleteSessionBySubjectId).toHaveBeenCalledWith(testSubject.id);
		});

		/**
		 * The sessions are already deleted by the time the relying parties are told, so a
		 * repository that cannot list the recipients leaves the sign-out complete.
		 */
		test("keeps the caller's sign-out complete when the recipient lookup fails", async () => {
			let repo = createMockRepository();
			repo.findSessionsForBackchannelLogout = vi.fn(async () => {
				throw new Error("sessions table unavailable");
			});

			let log = createMockLog();
			let provider = new OIDC(ISSUER, repo, log);

			expect(await provider.sendBackchannelLogoutTokens(testSubject.id)).toBeUndefined();

			expect(log.warn).toHaveBeenCalledWith("oidc.logout.backchannel_lookup_failed", {
				subjectId: testSubject.id,
				error: "sessions table unavailable",
			});
		});
	});

	describe("ID Token claims", () => {
		test("includes nonce when provided", async () => {
			testAuthzCode.nonce = "test-nonce-123";

			let repo = createMockRepository();
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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
			let provider = new OIDC(ISSUER, repo, createMockLog());

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

/** Password every credential login case signs in with. */
const LOGIN_PASSWORD = "correct horse battery staple";

/** Prefix the self-describing format writes, used to recognize a stored hash. */
const SCRYPT_PREFIX = "$scrypt$";

/** Cost standing in for a hash written before the current policy, cheap enough to keep tests fast. */
const OUTDATED_LOG_N = 12;

/** Block size the current policy expects, so only the cost trails it. */
const BLOCK_SIZE = 8;

/** Repetitions this hash records, below the current policy so it asks for a replacement. */
const PARALLELISM = 1;

const SALT_BYTES = 16;

const KEY_BYTES = 32;

/**
 * Hashes a password at an outdated cost, standing in for a credential stored
 * before the current policy and therefore due for an upgrade on login.
 *
 * @param secret - Plaintext password to hash.
 * @returns An encoded hash that verifies but reports as needing a rehash.
 */
function outdatedHash(secret: string): string {
	let salt = randomBytes(SALT_BYTES);

	let key = scryptSync(secret, salt, KEY_BYTES, {
		N: 2 ** OUTDATED_LOG_N,
		r: BLOCK_SIZE,
		p: PARALLELISM,
	});

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(new Uint8Array(key));

	return `${SCRYPT_PREFIX}ln=${OUTDATED_LOG_N},r=${BLOCK_SIZE},p=${PARALLELISM}$${encodedSalt}$${encodedKey}`;
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
 * given state so a test can assert on what was persisted.
 */
function createLoginRepository(state: LoginRepositoryState): OIDC.Repository {
	return {
		...createMockRepository(),

		findSubjectByEmail: vi.fn(async () => (state.subjectMissing ? null : testSubject)),

		createSubject: vi.fn(async (data: { avatar: string }) => {
			state.avatars.push(data.avatar);
			return testSubject;
		}),

		findCredential: vi.fn(async () => {
			if (state.storedHash === null) return null;
			return {
				subjectId: testSubject.id,
				passwordHash: state.storedHash,
				verifiedAt: state.verifiedAt,
			};
		}),

		createCredential: vi.fn(
			async (_subjectId: string, passwordHash: string, verifiedAt: Date | null) => {
				state.created.push(passwordHash);
				state.createdVerifiedAt.push(verifiedAt);
			},
		),

		updateCredentialPasswordHash: vi.fn(async (_subjectId: string, passwordHash: string) => {
			if (state.upgradeError) throw state.upgradeError;
			state.upgraded.push(passwordHash);
		}),

		createSession: vi.fn(async () => ({ id: testSession.id })),

		findOrCreateGrant: vi.fn(async () => ({
			id: "grant-123",
			subjectId: testSubject.id,
			clientId: testClient.id,
		})),

		storeAuthorizationCode: vi.fn(async () => {}),
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
		let state = loginState({ storedHash: outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
	});

	test("upgrades an outdated hash to the current policy after a successful sign-in", async () => {
		let state = loginState({ storedHash: outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		await provider.loginWithCredential(loginInput());

		expect(state.upgraded).toHaveLength(1);

		let upgraded = state.upgraded[0] ?? "";
		expect(upgraded.startsWith(SCRYPT_PREFIX)).toBe(true);
		expect(password.needsRehash(upgraded)).toBe(false);
		expect(unwrap(await password.verify(upgraded, LOGIN_PASSWORD))).toBe(true);
	});

	test("verifies against the upgraded hash on the next sign-in, without upgrading again", async () => {
		let state = loginState({ storedHash: outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		await provider.loginWithCredential(loginInput());
		state.storedHash = state.upgraded[0] ?? null;
		state.upgraded = [];

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		expect(state.upgraded).toHaveLength(0);
	});

	test("rejects a wrong password against an outdated hash and leaves it alone", async () => {
		let state = loginState({ storedHash: outdatedHash(LOGIN_PASSWORD) });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput({ password: "wrong password" }));

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
		expect(state.upgraded).toHaveLength(0);
	});

	test("rejects a wrong password against a stored hash", async () => {
		let state = loginState({ storedHash: unwrap(await password.hash(LOGIN_PASSWORD)) });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput({ password: "wrong password" }));

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
	});

	test("refuses a hash it cannot read instead of letting the sign-in through", async () => {
		let state = loginState({ storedHash: "not-a-hash-at-all" });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error).toBeInstanceOf(OIDC.AccessDeniedError);
	});

	test("still signs the subject in when persisting the upgrade fails", async () => {
		let state = loginState({
			storedHash: outdatedHash(LOGIN_PASSWORD),
			upgradeError: new Error("database unavailable"),
		});
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		expect(state.upgraded).toHaveLength(0);
	});

	test("reports the failed upgrade while still signing the subject in", async () => {
		let state = loginState({
			storedHash: outdatedHash(LOGIN_PASSWORD),
			upgradeError: new Error("database unavailable"),
		});
		let log = createMockLog();
		let provider = new OIDC(ISSUER, createLoginRepository(state), log);

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		expect(state.upgraded).toHaveLength(0);
		expect(log.warn).toHaveBeenCalledWith("auth.password_rehash_write_failed", {
			subjectId: testSubject.id,
			error: "database unavailable",
		});
	});

	test("refuses an unverified credential without checking the password", async () => {
		let state = loginState({
			storedHash: outdatedHash(LOGIN_PASSWORD),
			verifiedAt: null,
		});
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure")
			expect(result.error).toBeInstanceOf(OIDC.MissingValidationError);
		expect(state.upgraded).toHaveLength(0);
	});

	test("writes a hash when the subject has no credential yet, and refuses the sign-in", async () => {
		let state = loginState();
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("failure");
		if (result.status === "failure")
			expect(result.error).toBeInstanceOf(OIDC.MissingValidationError);
		expect(state.created).toHaveLength(1);
		expect((state.created[0] ?? "").startsWith(SCRYPT_PREFIX)).toBe(true);
	});

	test("stores that hash unverified, so a stranger cannot password-protect somebody else's account", async () => {
		let state = loginState();
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		await provider.loginWithCredential(loginInput());

		expect(state.createdVerifiedAt).toEqual([null]);
	});

	test("gives a brand-new subject a hex-digest gravatar and a password credential", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		await provider.loginWithCredential(loginInput());

		let expectedDigest = Hex.encode(unwrap(await sha256(testSubject.emailAddress)));
		expect(state.avatars).toEqual([`https://gravatar.com/avatar/${expectedDigest}`]);
		expect((state.created[0] ?? "").startsWith(SCRYPT_PREFIX)).toBe(true);
	});

	test("registers an unknown email and answers with a code instead of refusing it", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		let result = await provider.loginWithCredential(loginInput());

		expect(result.status).toBe("success");
		if (result.status === "success") expect(result.data.params.code).toBeTruthy();
	});

	/**
	 * The verified stamp is what lets the account sign in again with the same password
	 * right after registration.
	 */
	test("registers the credential verified, so the account it just created can sign in", async () => {
		let state = loginState({ subjectMissing: true });
		let provider = new OIDC(ISSUER, createLoginRepository(state), createMockLog());

		await provider.loginWithCredential(loginInput());

		expect(state.createdVerifiedAt).toHaveLength(1);
		expect(state.createdVerifiedAt[0]).toBeInstanceOf(Date);

		state.storedHash = state.created[0] ?? null;
		state.verifiedAt = state.createdVerifiedAt[0] ?? null;
		state.subjectMissing = false;

		let signIn = await provider.loginWithCredential(loginInput());

		expect(signIn.status).toBe("success");
	});
});

describe("generateAuthzCode", () => {
	/** The authorization request the failing storage below is asked to answer. */
	const INPUT = {
		subjectId: testSubject.id,
		clientId: testClient.id,
		ip: null,
		ua: null,
		redirectUri: testClient.redirectUri,
		state: "state-123",
	};

	/**
	 * The description travels to the relying party as an `error_description` query
	 * parameter on its redirect URI, so it stays a fixed sentence: a runtime message put
	 * there would reach the client's logs, its browser history and its `Referer` headers.
	 */
	test("reports a storage failure with a fixed description and logs the detail", async () => {
		let log = createMockLog();
		let repo = {
			...createMockRepository(),
			createSession: vi.fn(async () => {
				throw new Error("D1_ERROR: no such table: sessions");
			}),
			findOrCreateGrant: vi.fn(async () => ({ id: "grant-123" })),
			storeAuthorizationCode: vi.fn(async () => {}),
		} as unknown as OIDC.Repository;

		let result = await new OIDC(ISSUER, repo, log).generateAuthzCode(INPUT);

		expect(result.status).toBe("failure");
		if (result.status !== "failure") return;

		expect(result.error).toBeInstanceOf(OIDC.InternalServerError);
		expect(result.error.code).toBe("internal_server_error");
		expect(result.error.description).toBe("Internal server error");
		expect(result.error.description).not.toContain("D1_ERROR");

		expect(log.warn).toHaveBeenCalledWith("oidc.authorize.code_issue_failed", {
			clientId: testClient.id,
			subjectId: testSubject.id,
			error: "D1_ERROR: no such table: sessions",
		});
	});
});
