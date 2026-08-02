/**
 * Core OAuth 2.0 / OIDC provider for the auth app. Implements the token,
 * revoke, introspect, userinfo, and logout endpoints plus the authorization-
 * code, refresh-token, and client-credentials grants, PKCE and login flows, and
 * back-/front-channel logout, working against a pluggable repository interface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { JWK, JWT } from "@edgefirst-dev/jwt";
import {
	Base64Url,
	CryptoError,
	Hex,
	password,
	randomBytes,
	sha256,
	timingSafeEqual,
} from "@pkg/crypto";
import { elapsed } from "@pkg/dates";
import { failure, isFailure, success } from "@pkg/result";
import bcrypt from "bcryptjs";

import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";
import LogoutToken from "../entities/logout-token";

/**
 * Bytes of entropy behind the session-state salt, matching the length this
 * server has always emitted so a `session_state` stays the same shape.
 */
const SESSION_STATE_SALT_BYTES = 16;

/**
 * Bytes of entropy behind the OP browser state. The value lives in a 30-day
 * cookie and is fed back into the session-state hash by the check-session
 * iframe, so its encoding cannot change while old cookies are still in flight.
 */
const OP_BROWSER_STATE_BYTES = 32;

/**
 * Shape of a bcrypt hash (`$2a$`, `$2b$`, `$2y$`), used to route a stored
 * credential to the legacy verifier. Hashes written today are PBKDF2 and carry
 * their own `$pbkdf2-sha256$` tag instead.
 */
const BCRYPT_HASH_PATTERN = /^\$2[aby]?\$/;

// =============================================================================
// Errors
// =============================================================================

class OAuth2Error extends globalThis.Error {
	override readonly name: string = "OAuth2Error";

	constructor(
		readonly code: string,
		readonly description: string,
	) {
		super(`OAuth2 error: ${code}`);
	}
}

class InvalidClientError extends OAuth2Error {
	override readonly name = "InvalidClientError";

	constructor(override readonly description: string) {
		super("invalid_client", description);
	}
}

class InvalidGrantError extends OAuth2Error {
	override readonly name = "InvalidGrantError";

	constructor(override readonly description: string) {
		super("invalid_grant", description);
	}
}

class InvalidRequestError extends OAuth2Error {
	override readonly name = "InvalidRequestError";

	constructor(override readonly description: string) {
		super("invalid_request", description);
	}
}

class InvalidScopeError extends OAuth2Error {
	override readonly name = "InvalidScopeError";

	constructor(override readonly description: string) {
		super("invalid_scope", description);
	}
}

class UnauthorizedClientError extends OAuth2Error {
	override readonly name = "UnauthorizedClientError";

	constructor(override readonly description: string = "Unauthorized client") {
		super("unauthorized_client", description);
	}
}

class UnsupportedGrantTypeError extends OAuth2Error {
	override readonly name = "UnsupportedGrantTypeError";

	constructor(override readonly description: string) {
		super("unsupported_grant_type", description);
	}
}

class UnsupportedResponseTypeError extends OAuth2Error {
	override readonly name = "UnsupportedResponseTypeError";

	constructor(override readonly description: string) {
		super("unsupported_response_type", description);
	}
}

class AccessDeniedError extends OAuth2Error {
	override readonly name = "AccessDeniedError";

	constructor(override readonly description: string) {
		super("access_denied", description);
	}
}

class InternalServerError extends OAuth2Error {
	override readonly name = "InternalServerError";

	constructor(override readonly description: string = "Internal server error") {
		super("internal_server_error", description);
	}
}

class MissingValidationError extends OAuth2Error {
	override readonly name = "MissingValidationError";

	constructor(override readonly description: string = "Verification required") {
		super("missing_validation", description);
	}
}

// =============================================================================
// Types
// =============================================================================

type Nullable<T> = T | null;

export namespace OIDC {
	export interface Subject {
		id: string;
		avatar: string;
		username: string;
		displayName: string;
		emailAddress: string;
		emailVerifiedAt: Date | null;
	}

	export interface Credential {
		subjectId: string;
		passwordHash: string;
		verifiedAt: Date | null;
	}

	export interface Grant {
		id: string;
		subjectId: string;
		clientId: string;
	}

	export interface SessionWithClient {
		sessionId: string;
		clientId: string;
		backchannelLogoutUri: string | null;
		backchannelLogoutSessionRequired: string | null;
		frontchannelLogoutUri: string | null;
		frontchannelLogoutSessionRequired: string | null;
	}

	export interface Repository {
		getSigningKey(): Promise<JWK.KeyPair[]>;

		findClientById(clientId: string): Promise<
			Nullable<{
				id: string;
				name: string;
				secret: string;
				logoutUri: string;
				redirectUri: string;
			}>
		>;

		findSessionById(sessionId: string): Promise<
			Nullable<{
				id: string;
				clientId: string;
				subjectId: string;
				expiresAt: Date;
				createdAt: Date;
			}>
		>;

		findAuthorizationCodeData(code: string): Promise<
			Nullable<{
				clientId: string;
				subjectId: string;
				sessionId: string;
				pkce: { challenge: string; method: "S256" | "plain" } | null;
				nonce: string | null;
				scope: string[];
				authTime?: number;
			}>
		>;

		deleteSessionBySubjectId(subjectId: string): Promise<void>;
		deleteSessionById(sessionId: string): Promise<void>;
		touchSession(sessionId: string): Promise<void>;

		findSubjectById(subjectId: string): Promise<Nullable<Subject>>;

		// Login flow methods
		findSubjectByEmail(email: string): Promise<Nullable<Subject>>;
		createSubject(data: {
			emailAddress: string;
			displayName: string;
			username: string;
			avatar: string;
		}): Promise<Subject>;

		findCredential(subjectId: string): Promise<Nullable<Credential>>;
		createCredential(subjectId: string, passwordHash: string): Promise<void>;
		/**
		 * Replaces the stored hash for a subject that already has a credential.
		 *
		 * Called only after a password verified, to retire a hash written under an
		 * older scheme; it must never create a row, since a missing credential means
		 * the subject has no password rather than an outdated one.
		 */
		updateCredentialPasswordHash(subjectId: string, passwordHash: string): Promise<void>;

		createSession(
			subjectId: string,
			clientId: string,
			ip: string | null,
			ua: string | null,
		): Promise<{ id: string }>;

		findOrCreateGrant(subjectId: string, clientId: string): Promise<Grant>;

		storeAuthorizationCode(
			code: string,
			data: {
				clientId: string;
				subjectId: string;
				sessionId: string;
				pkce: { challenge: string; method: "S256" | "plain" } | null;
				nonce: string | null;
				scope: string[];
				authTime: number;
			},
		): Promise<void>;

		// Logout flow methods
		findSessionsForBackchannelLogout(
			subjectId: string,
			excludeClientId?: string,
		): Promise<SessionWithClient[]>;

		findSessionsForFrontchannelLogout(
			subjectId: string,
			excludeClientId?: string,
		): Promise<SessionWithClient[]>;
	}

	export interface GenerateAuthzCodeInput {
		subjectId: string;
		clientId: string;
		ip: string | null;
		ua: string | null;
		redirectUri: string;
		state: string;
		nonce?: string | null;
		scope?: string[];
		opBrowserState?: string;
		responseMode?: "query" | "fragment" | "form_post";
	}

	export interface LoginWithCredentialInput {
		email: string;
		password: string;
		name: string;
		username: string;
		clientId: string;
		ip: string | null;
		ua: string | null;
		redirectUri: string;
		state: string;
		nonce?: string;
		scope?: string[];
		opBrowserState?: string;
		responseMode?: "query" | "fragment" | "form_post";
	}

	export interface AuthzCodeResult {
		redirectUri: string;
		params: Record<string, string>;
		responseMode: "query" | "fragment" | "form_post";
		subjectId: string;
	}

	export interface FrontchannelLogoutUrl {
		clientId: string;
		url: string;
	}
}

// =============================================================================
// OIDC Provider Class
// =============================================================================

export class OIDC {
	// Static error classes
	static Error = OAuth2Error;
	static InvalidClientError = InvalidClientError;
	static InvalidGrantError = InvalidGrantError;
	static InvalidRequestError = InvalidRequestError;
	static InvalidScopeError = InvalidScopeError;
	static UnauthorizedClientError = UnauthorizedClientError;
	static UnsupportedGrantTypeError = UnsupportedGrantTypeError;
	static UnsupportedResponseTypeError = UnsupportedResponseTypeError;
	static AccessDeniedError = AccessDeniedError;
	static InternalServerError = InternalServerError;
	static MissingValidationError = MissingValidationError;

	// Token classes
	static AccessToken = AccessToken;
	static IdToken = IdToken;

	constructor(
		private issuer: string,
		private repository: OIDC.Repository,
	) {}

	// =========================================================================
	// Token Endpoint
	// =========================================================================

	async token(
		args:
			| {
					type: "authorization_code";
					code: string;
					redirectUri: string;
					codeVerifier?: string;
					clientId?: string;
					clientSecret?: string;
			  }
			| {
					type: "refresh_token";
					refreshToken: string;
			  }
			| {
					type: "client_credentials";
					resource: string[];
					clientId: string;
					clientSecret: string;
			  },
	) {
		if (args.type === "authorization_code") {
			return await this.authorizationCodeGrant(args);
		}

		if (args.type === "refresh_token") {
			return await this.refreshTokenGrant(args);
		}

		if (args.type === "client_credentials") {
			return await this.clientCredentialsGrant(args);
		}

		throw new UnsupportedGrantTypeError("Invalid grant type");
	}

	async revoke(args: {
		clientId: string;
		clientSecret: string;
		token: string;
		tokenTypeHint?: "access_token" | "refresh_token";
	}) {
		let client = await this.repository.findClientById(args.clientId);
		if (!client || !timingSafeEqual(client.secret, args.clientSecret)) {
			throw new InvalidClientError("Invalid client credentials");
		}

		if (args.tokenTypeHint === "access_token") {
			return;
		}

		let session = await this.repository.findSessionById(args.token);
		if (!session) {
			return;
		}

		if (session.clientId !== args.clientId) {
			throw new UnauthorizedClientError();
		}

		await this.repository.deleteSessionById(session.id);
	}

	async introspect(args: {
		clientId: string;
		clientSecret: string;
		token: string;
		tokenTypeHint?: "access_token" | "refresh_token";
	}): Promise<
		| { active: false }
		| {
				active: true;
				sub: string;
				client_id: string;
				exp: number;
				iat: number;
				iss: string;
				aud: string | string[];
				token_type: "Bearer";
		  }
	> {
		let client = await this.repository.findClientById(args.clientId);
		if (!client || !timingSafeEqual(client.secret, args.clientSecret)) {
			throw new InvalidClientError("Invalid client credentials");
		}

		if (args.tokenTypeHint !== "access_token") {
			let session = await this.repository.findSessionById(args.token);
			if (session && session.expiresAt > new Date()) {
				return {
					active: true,
					sub: session.subjectId,
					client_id: session.clientId,
					exp: Math.floor(session.expiresAt.getTime() / 1000),
					iat: Math.floor(session.expiresAt.getTime() / 1000) - 30 * 24 * 60 * 60,
					iss: this.issuer,
					aud: session.clientId,
					token_type: "Bearer",
				};
			}
		}

		try {
			let accessToken = await AccessToken.verify(
				args.token,
				await this.repository.getSigningKey(),
				{ issuer: this.issuer },
			);

			return {
				active: true,
				sub: accessToken.subject,
				client_id: accessToken.audience as string,
				exp: Math.floor(accessToken.expiresIn / 1000),
				iat: Math.floor(accessToken.issuedAt.getTime() / 1000),
				iss: accessToken.issuer,
				aud: accessToken.audience,
				token_type: "Bearer",
			};
		} catch {
			return { active: false };
		}
	}

	// =========================================================================
	// OIDC Endpoints
	// =========================================================================

	async userinfo(args: { accessToken: string; clientId?: string }) {
		let accessToken = await AccessToken.verify(
			args.accessToken,
			await this.repository.getSigningKey(),
			{ issuer: this.issuer },
		);

		let subject = await this.repository.findSubjectById(accessToken.subject);
		let scope = accessToken.scope?.split(" ") ?? ["openid"];

		return { subject, scope };
	}

	async logout(args: {
		idTokenHint?: string;
		postLogoutRedirectUri?: string;
		sessionSubject?: string;
		clientId?: string;
		state?: string;
	}) {
		let subjectId: string;
		let clientId: string | undefined;
		let client: Awaited<ReturnType<typeof this.repository.findClientById>> | null = null;

		if (args.idTokenHint) {
			let idToken = await IdToken.verify(args.idTokenHint, await this.repository.getSigningKey(), {
				issuer: this.issuer,
				algorithms: [JWK.Algoritm.ES256],
			});

			if (!idToken.subject) throw new InvalidRequestError("Invalid subject");
			if (!idToken.audience) throw new InvalidRequestError("Invalid audience");
			if (Array.isArray(idToken.audience)) throw new InvalidRequestError("Invalid audience");

			subjectId = idToken.subject;
			clientId = idToken.audience;

			if (args.clientId && args.clientId !== idToken.audience) {
				throw new InvalidRequestError("client_id does not match id_token_hint audience");
			}

			client = await this.repository.findClientById(idToken.audience);
		} else if (args.sessionSubject) {
			subjectId = args.sessionSubject;
			clientId = args.clientId;

			if (args.clientId) {
				client = await this.repository.findClientById(args.clientId);
			}
		} else {
			throw new InvalidRequestError("id_token_hint or session subject required");
		}

		let subject = await this.repository.findSubjectById(subjectId);
		if (!subject) throw new InvalidRequestError("Invalid subject");

		if (args.postLogoutRedirectUri && client) {
			if (client.logoutUri !== args.postLogoutRedirectUri) {
				throw new InvalidRequestError("Invalid redirect uri");
			}
		}

		if (args.sessionSubject && args.sessionSubject !== subject.id) {
			throw new InvalidRequestError("Invalid session subject");
		}

		await this.repository.deleteSessionBySubjectId(subject.id);

		return {
			subjectId: subject.id,
			clientId,
			redirectUri: args.postLogoutRedirectUri,
		};
	}

	// =========================================================================
	// Login Methods
	// =========================================================================

	async generateAuthzCode(input: OIDC.GenerateAuthzCodeInput) {
		try {
			let authTime = Math.floor(Date.now() / 1000);

			let [session, _grant] = await Promise.all([
				this.repository.createSession(input.subjectId, input.clientId, input.ip, input.ua),
				this.repository.findOrCreateGrant(input.subjectId, input.clientId),
			]);

			let code = crypto.randomUUID();
			await this.repository.storeAuthorizationCode(code, {
				clientId: input.clientId,
				subjectId: input.subjectId,
				sessionId: session.id,
				pkce: null,
				nonce: input.nonce ?? null,
				scope: input.scope ?? ["openid"],
				authTime,
			});

			let params: Record<string, string> = {
				code,
				state: input.state,
				iss: `https://${this.issuer}`,
			};

			if (input.opBrowserState) {
				params.session_state = await this.generateSessionState(
					input.clientId,
					input.redirectUri,
					input.opBrowserState,
				);
			}

			return success({
				redirectUri: input.redirectUri,
				params,
				responseMode: input.responseMode ?? "query",
				subjectId: input.subjectId,
			});
		} catch (error) {
			if (error instanceof Error) {
				return failure(new InternalServerError(error.message));
			}
			return failure(new InternalServerError());
		}
	}

	/**
	 * Signs a subject in with an email and password, issuing an authorization code
	 * on success.
	 *
	 * An unknown email creates the subject and a credential and still fails with
	 * `MissingValidationError`, so the response cannot be used to tell registered
	 * addresses from unregistered ones. A correct password against a hash written
	 * under an older scheme is upgraded in place before the code is issued.
	 *
	 * @param input - Credentials plus the authorization request to resume.
	 * @returns The authorization code result, or why the sign-in was refused.
	 */
	async loginWithCredential(input: OIDC.LoginWithCredentialInput) {
		let subject = await this.repository.findSubjectByEmail(input.email);

		if (subject) {
			let credential = await this.repository.findCredential(subject.id);

			if (!credential) {
				let passwordHash = await password.hash(input.password);
				if (isFailure(passwordHash)) return failure(new InternalServerError());

				await this.repository.createCredential(subject.id, passwordHash.data);
				return failure(new MissingValidationError("Verify your email address."));
			}

			if (credential.verifiedAt === null) {
				return failure(new MissingValidationError("Verify your email address."));
			}

			let passwordValid = await verifyPassword(credential.passwordHash, input.password);
			if (isFailure(passwordValid) || !passwordValid.data) {
				return failure(new AccessDeniedError("Invalid email or password."));
			}

			await this.upgradePasswordHash(subject.id, credential.passwordHash, input.password);
		} else {
			let emailHash = await sha256Hex(input.email);

			subject = await this.repository.createSubject({
				emailAddress: input.email,
				displayName: input.name,
				avatar: `https://gravatar.com/avatar/${emailHash}`,
				username: input.username,
			});

			let passwordHash = await password.hash(input.password);
			if (isFailure(passwordHash)) return failure(new InternalServerError());

			await this.repository.createCredential(subject.id, passwordHash.data);

			return failure(new MissingValidationError("Verify your email address."));
		}

		return await this.generateAuthzCode({
			subjectId: subject.id,
			clientId: input.clientId,
			ip: input.ip,
			ua: input.ua,
			redirectUri: input.redirectUri,
			state: input.state,
			nonce: input.nonce,
			scope: input.scope,
			opBrowserState: input.opBrowserState,
			responseMode: input.responseMode,
		});
	}

	async loginWithProvider(input: OIDC.GenerateAuthzCodeInput) {
		return await this.generateAuthzCode(input);
	}

	// =========================================================================
	// Logout Notification Methods
	// =========================================================================

	async sendBackchannelLogoutTokens(subjectId: string, excludeClientId?: string): Promise<void> {
		let sessions = await this.repository.findSessionsForBackchannelLogout(
			subjectId,
			excludeClientId,
		);

		let clientsToNotify = sessions.filter((s) => s.backchannelLogoutUri);

		if (clientsToNotify.length === 0) {
			return;
		}

		let signingKeys = await this.repository.getSigningKey();

		await Promise.allSettled(
			clientsToNotify.map(async (client) => {
				let sessionId =
					client.backchannelLogoutSessionRequired === "true" ? client.sessionId : undefined;

				let logoutToken = LogoutToken.generate(subjectId, client.clientId, sessionId);
				let signedToken = await logoutToken.sign(JWK.Algoritm.ES256, signingKeys);

				let response = await fetch(client.backchannelLogoutUri!, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({ logout_token: signedToken }),
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				return { clientId: client.clientId, status: "success" };
			}),
		);
	}

	async getFrontchannelLogoutUrls(
		subjectId: string,
		excludeClientId?: string,
	): Promise<OIDC.FrontchannelLogoutUrl[]> {
		let sessions = await this.repository.findSessionsForFrontchannelLogout(
			subjectId,
			excludeClientId,
		);

		let clientsToNotify = sessions.filter((s) => s.frontchannelLogoutUri);

		if (clientsToNotify.length === 0) {
			return [];
		}

		let urls: OIDC.FrontchannelLogoutUrl[] = [];

		for (let client of clientsToNotify) {
			let logoutUrl = new URL(client.frontchannelLogoutUri!);
			logoutUrl.searchParams.set("iss", `https://${this.issuer}`);

			if (client.frontchannelLogoutSessionRequired === "true") {
				logoutUrl.searchParams.set("sid", client.sessionId);
			}

			urls.push({
				clientId: client.clientId,
				url: logoutUrl.toString(),
			});
		}

		return urls;
	}

	// =========================================================================
	// Session State Methods
	// =========================================================================

	/**
	 * Builds the OIDC Session Management `session_state` value: the hex SHA-256 of
	 * client id, RP origin, browser state and a fresh salt, joined to that salt so
	 * the check-session iframe can recompute the same digest.
	 *
	 * @param clientId - The relying party the state is issued to.
	 * @param redirectUri - Only its origin is hashed, as the specification requires.
	 * @param opBrowserState - Opaque per-browser value read back from its cookie.
	 * @returns `<hash>.<salt>`, both lowercase hex.
	 */
	async generateSessionState(
		clientId: string,
		redirectUri: string,
		opBrowserState: string,
	): Promise<string> {
		let origin = new URL(redirectUri).origin;
		let salt = Hex.encode(randomBytes(SESSION_STATE_SALT_BYTES));
		let input = `${clientId} ${origin} ${opBrowserState} ${salt}`;
		let hash = await sha256Hex(input);
		return `${hash}.${salt}`;
	}

	/**
	 * Mints the opaque per-browser value stored in the `op_browser_state` cookie.
	 *
	 * Lowercase hex, because the check-session iframe concatenates it into the
	 * digest input verbatim and cookies already in flight carry that encoding.
	 *
	 * @returns 32 random bytes as hex.
	 */
	generateOpBrowserState(): string {
		return Hex.encode(randomBytes(OP_BROWSER_STATE_BYTES));
	}

	// =========================================================================
	// Discovery
	// =========================================================================

	get wellKnown() {
		return {
			issuer: this.issuer,
			code_challenge_methods_supported: ["S256", "plain"],
			id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
			request_parameter_supported: false,
			request_uri_parameter_supported: false,
			response_types_supported: ["code", "token"],
			scopes_supported: [] as string[],
		};
	}

	get jwks() {
		return this.repository.getSigningKey().then(JWK.toJSON);
	}

	// =========================================================================
	// Grant Type Implementations
	// =========================================================================

	private async authorizationCodeGrant(args: {
		code: string;
		redirectUri: string;
		codeVerifier?: string;
		clientId?: string;
		clientSecret?: string;
	}) {
		let authz = await this.repository.findAuthorizationCodeData(args.code);
		if (!authz) throw new InvalidGrantError("Code has expired or is invalid");

		let { clientId, subjectId, sessionId, pkce } = authz;

		let [client, session] = await Promise.all([
			this.repository.findClientById(clientId),
			this.repository.findSessionById(sessionId),
		]);

		if (!client) throw new InvalidClientError("Client not found");
		if (!session) throw new InvalidGrantError("Session not found");
		if (elapsed(session.expiresAt) > 0) {
			throw new InvalidGrantError("Session has expired");
		}

		if (client.secret) {
			if (!args.clientId || !args.clientSecret) {
				throw new InvalidClientError("Client authentication required");
			}
			if (args.clientId !== clientId) {
				throw new InvalidClientError("Client ID mismatch");
			}
			if (!timingSafeEqual(client.secret, args.clientSecret)) {
				throw new InvalidClientError("Invalid client credentials");
			}
		}

		if (client.redirectUri !== args.redirectUri) {
			throw new InvalidGrantError("Redirect URI mismatch");
		}

		if (pkce) {
			if (!args.codeVerifier) {
				throw new InvalidRequestError("Missing code_verifier");
			}

			if (pkce.method === "S256") {
				let isValid = await CodeChallenge.validate(args.codeVerifier, pkce.challenge, pkce.method);
				if (!isValid) throw new InvalidGrantError("PKCE validation failed");
			} else if (pkce.method === "plain") {
				if (args.codeVerifier !== pkce.challenge) {
					throw new InvalidGrantError("PKCE validation failed");
				}
			} else {
				throw new InvalidRequestError("Unsupported PKCE method");
			}
		}

		let subject = await this.repository.findSubjectById(subjectId);
		if (!subject) throw new InvalidGrantError("Subject not found");

		let accessToken = await this.signJWT(AccessToken.generate(clientId, subjectId, authz.scope));

		let idToken = await this.signJWT(
			IdToken.generate(
				{
					id: subject.id,
					email: subject.emailAddress,
					avatar: subject.avatar,
					username: subject.username,
					displayName: subject.displayName,
					emailVerified: subject.emailVerifiedAt !== null,
				},
				{ id: authz.clientId },
				{ nonce: authz.nonce, scope: authz.scope, authTime: authz.authTime },
			),
		);

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			refresh_token: sessionId,
			expires_in: AccessToken.ttl,
			id_token: idToken,
		};
	}

	private async clientCredentialsGrant(args: {
		resource: string[];
		clientId: string;
		clientSecret: string;
	}) {
		let client = await this.repository.findClientById(args.clientId);
		if (!client) throw new InvalidClientError("Client is not registered");

		if (!timingSafeEqual(client.secret, args.clientSecret)) {
			throw new InvalidClientError("Client is not registered");
		}

		let accessToken = await this.signJWT(
			AccessToken.generate([this.issuer, ...args.resource], args.clientId),
		);

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			expires_in: AccessToken.ttl,
		};
	}

	private async refreshTokenGrant(args: { refreshToken: string }) {
		let session = await this.repository.findSessionById(args.refreshToken);
		if (!session) {
			throw new InvalidGrantError("Invalid or expired refresh token");
		}

		if (elapsed(session.expiresAt) > 0) {
			throw new InvalidGrantError("Session has expired");
		}

		let client = await this.repository.findClientById(session.clientId);
		if (!client) throw new InvalidClientError("Client is not registered");

		await this.repository.touchSession(session.id);

		let subject = await this.repository.findSubjectById(session.subjectId);
		if (!subject) throw new InvalidGrantError("Subject not found");

		let accessToken = await this.signJWT(AccessToken.generate(session.clientId, session.subjectId));

		let authTime = Math.floor(session.createdAt.getTime() / 1000);

		let idToken = await this.signJWT(
			IdToken.generate(
				{
					id: subject.id,
					email: subject.emailAddress,
					avatar: subject.avatar,
					username: subject.username,
					displayName: subject.displayName,
					emailVerified: subject.emailVerifiedAt !== null,
				},
				{ id: session.clientId },
				{ authTime },
			),
		);

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			expires_in: AccessToken.ttl,
			refresh_token: session.id,
			id_token: idToken,
		};
	}

	// =========================================================================
	// Private Helper Methods
	// =========================================================================

	private async signJWT(jwt: JWT) {
		return await jwt.sign(JWK.Algoritm.ES256, await this.repository.getSigningKey());
	}

	/**
	 * Replaces a stored hash that is behind current policy, right after the only
	 * moment the plaintext exists: a successful sign-in.
	 *
	 * A bcrypt hash can never be converted without the password, so this is the
	 * one chance to retire it. The upgrade is best effort — a failed re-hash or a
	 * failed write leaves the old hash in place and the next sign-in tries again,
	 * because refusing a correct password would be far worse than a late upgrade.
	 *
	 * @param subjectId - Owner of the credential being upgraded.
	 * @param stored - The hash that was just verified.
	 * @param plaintext - The password that verified against it.
	 */
	private async upgradePasswordHash(
		subjectId: string,
		stored: string,
		plaintext: string,
	): Promise<void> {
		if (!password.needsRehash(stored)) return;

		let rehashed = await password.hash(plaintext);
		if (isFailure(rehashed)) return;

		try {
			await this.repository.updateCredentialPasswordHash(subjectId, rehashed.data);
		} catch {
			// Keep the verified hash; the next successful sign-in retries the upgrade.
		}
	}
}

// Keep OIDCProvider as an alias for backward compatibility
export { OIDC as OIDCProvider };

// =============================================================================
// Helper Classes
// =============================================================================

/**
 * PKCE code challenge derivation and checking (RFC 7636).
 */
class CodeChallenge {
	/**
	 * Derives the challenge a verifier produces under a method: the unpadded
	 * base64url SHA-256 for `S256`, and the verifier itself for `plain`.
	 *
	 * @param verifier - The `code_verifier` presented at the token endpoint.
	 * @param method - The method recorded with the authorization code.
	 * @returns The derived challenge, or `null` when the digest could not be taken.
	 */
	private static async generate(
		verifier: string,
		method: "S256" | "plain",
	): Promise<string | null> {
		if (method === "plain") return verifier;

		let digest = await sha256(verifier);
		if (isFailure(digest)) return null;

		return Base64Url.encode(digest.data);
	}

	/**
	 * Checks a verifier against the stored challenge.
	 *
	 * Fails closed: a digest the runtime refuses is reported as a mismatch rather
	 * than letting the grant through unchecked.
	 *
	 * @param verifier - The `code_verifier` presented at the token endpoint.
	 * @param challenge - The `code_challenge` stored with the authorization code.
	 * @param method - The challenge method; defaults to `S256`.
	 * @returns Whether the verifier derives exactly the stored challenge.
	 */
	static async validate(
		verifier: string,
		challenge: string,
		method: "S256" | "plain" = "S256",
	): Promise<boolean> {
		let generatedChallenge = await CodeChallenge.generate(verifier, method);
		if (generatedChallenge === null) return false;

		return timingSafeEqual(generatedChallenge, challenge);
	}
}

/**
 * Lowercase hex SHA-256 of a string, the encoding both the gravatar URL and the
 * OIDC session state are already published with.
 *
 * @param message - Text to digest, read as UTF-8.
 * @returns The digest as 64 lowercase hex characters.
 * @throws {InternalServerError} If the runtime refuses the digest.
 */
async function sha256Hex(message: string): Promise<string> {
	let digest = await sha256(message);
	if (isFailure(digest)) throw new InternalServerError(digest.error.message);

	return Hex.encode(digest.data);
}

/**
 * Checks a password against a stored credential hash, in whichever format it was
 * written.
 *
 * Both formats are self-identifying, so the stored value picks its own verifier:
 * a `$2…$` prefix means bcrypt, from before this server moved to PBKDF2, and
 * anything else is handed to the PBKDF2 verifier. A wrong password is
 * `success(false)`; only a hash no verifier can read is a failure, which keeps
 * "wrong password" apart from "cannot check".
 *
 * @param stored - The hash held for the subject.
 * @param plaintext - The password presented at sign-in.
 * @returns Whether the password matches, or why the check could not run.
 */
async function verifyPassword(
	stored: string,
	plaintext: string,
): Promise<Result<boolean, CryptoError>> {
	if (!BCRYPT_HASH_PATTERN.test(stored)) return await password.verify(stored, plaintext);

	try {
		return success(await bcrypt.compare(plaintext, stored));
	} catch {
		return failure(new CryptoError("bcrypt verification failed"));
	}
}
