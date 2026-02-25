import { timingSafeEqual } from "node:crypto";

import { JWK, JWT } from "@edgefirst-dev/jwt";
import { isBefore } from "date-fns";
import { base64url } from "jose";

import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";

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
// OIDC Provider
// =============================================================================

type Nullable<T> = T | null;

export namespace OAuth2Provider {
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
				createdAt: Date; // For auth_time claim
			}>
		>;

		findAuthorizationCodeData(code: string): Promise<{
			clientId: string;
			subjectId: string;
			sessionId: string;
			pkce: { challenge: string; method: "S256" | "plain" } | null;
			nonce: string | null;
			scope: string[];
			authTime?: number; // Unix timestamp in seconds when user authenticated
		}>;

		deleteSessionBySubjectId(subjectId: string): Promise<void>;
		deleteSessionById(sessionId: string): Promise<void>;
		touchSession(sessionId: string): Promise<void>;
	}
}

class OAuth2Provider<Repository extends OAuth2Provider.Repository> {
	constructor(
		protected issuer: string,
		protected repository: Repository,
	) {}

	authorize(_args: {
		clientId: string;
		redirectUri: string;
		scope?: string;
		state?: string;
		responseType?: "code" | "token";
	}) {
		throw new Error("Authorization method is not implemented yet");
	}

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
		// Validate client credentials using constant-time comparison
		let client = await this.repository.findClientById(args.clientId);
		if (!client || !secureCompare(client.secret, args.clientSecret)) {
			throw new InvalidClientError("Invalid client credentials");
		}

		// For access tokens (JWTs), we can't truly revoke them - just return success
		if (args.tokenTypeHint === "access_token") {
			return;
		}

		// For refresh tokens (session IDs), delete the session
		let session = await this.repository.findSessionById(args.token);
		if (!session) {
			// Per RFC 7009, return success even for invalid tokens
			return;
		}

		// Verify the token belongs to this client
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
		// Validate client credentials using constant-time comparison
		let client = await this.repository.findClientById(args.clientId);
		if (!client || !secureCompare(client.secret, args.clientSecret)) {
			throw new InvalidClientError("Invalid client credentials");
		}

		// Try to introspect as refresh token (session ID)
		if (args.tokenTypeHint !== "access_token") {
			let session = await this.repository.findSessionById(args.token);
			if (session && session.expiresAt > new Date()) {
				return {
					active: true,
					sub: session.subjectId,
					client_id: session.clientId,
					exp: Math.floor(session.expiresAt.getTime() / 1000),
					iat: Math.floor(session.expiresAt.getTime() / 1000) - 30 * 24 * 60 * 60, // 30 days before expiry
					iss: this.issuer,
					aud: session.clientId,
					token_type: "Bearer",
				};
			}
		}

		// Try to introspect as access token (JWT)
		try {
			let accessToken = await AccessToken.verify(
				args.token,
				await this.repository.getSigningKey(),
				{
					issuer: this.issuer,
				},
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
			// Token is invalid or expired
			return { active: false };
		}
	}

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

	protected async authorizationCodeGrant(args: {
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
		if (isBefore(session.expiresAt, new Date())) {
			throw new InvalidGrantError("Session has expired");
		}

		// Validate client authentication for confidential clients
		// Per RFC 6749, confidential clients MUST authenticate when exchanging codes
		if (client.secret) {
			if (!args.clientId || !args.clientSecret) {
				throw new InvalidClientError("Client authentication required");
			}
			if (args.clientId !== clientId) {
				throw new InvalidClientError("Client ID mismatch");
			}
			if (!secureCompare(client.secret, args.clientSecret)) {
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

		let accessToken = await this.signJWT(AccessToken.generate(clientId, subjectId, authz.scope));

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			refresh_token: sessionId,
			expires_in: AccessToken.ttl,
		};
	}

	protected async clientCredentialsGrant(args: {
		resource: string[];
		clientId: string;
		clientSecret: string;
	}) {
		let client = await this.repository.findClientById(args.clientId);
		if (!client) throw new InvalidClientError("Client is not registered");

		// Use constant-time comparison to prevent timing attacks
		if (!secureCompare(client.secret, args.clientSecret)) {
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

	protected async refreshTokenGrant(args: { refreshToken: string }) {
		let session = await this.repository.findSessionById(args.refreshToken);
		if (!session) {
			throw new InvalidGrantError("Invalid or expired refresh token");
		}

		// Check if session has expired
		if (isBefore(session.expiresAt, new Date())) {
			throw new InvalidGrantError("Session has expired");
		}

		let client = await this.repository.findClientById(session.clientId);

		if (!client) throw new InvalidClientError("Client is not registered");

		// Update session's last activity timestamp
		await this.repository.touchSession(session.id);

		let accessToken = await this.signJWT(AccessToken.generate(session.clientId, session.subjectId));

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			expires_in: AccessToken.ttl,
			refresh_token: session.id,
		};
	}

	protected async signJWT(jwt: JWT) {
		return await jwt.sign(JWK.Algoritm.ES256, await this.repository.getSigningKey());
	}
}

export namespace OIDCProvider {
	export interface Repository extends OAuth2Provider.Repository {
		findSubjectById(subjectId: string): Promise<
			Nullable<{
				id: string;
				avatar: string;
				username: string;
				displayName: string;
				emailAddress: string;
				emailVerifiedAt: Date | null;
			}>
		>;
	}
}

export class OIDCProvider extends OAuth2Provider<OIDCProvider.Repository> {
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
		clientId?: string; // OIDC RP-Initiated Logout 1.0
		state?: string;
	}) {
		let subjectId: string;
		let clientId: string | undefined;
		let client: Awaited<ReturnType<typeof this.repository.findClientById>> | null = null;

		// If id_token_hint is provided, verify and extract subject/client
		if (args.idTokenHint) {
			let idToken = await IdToken.verify(args.idTokenHint, await this.repository.getSigningKey(), {
				issuer: this.issuer,
				algorithms: [JWK.Algoritm.ES256],
			});

			if (!idToken.subject) throw new InvalidRequestError("Invalid subject");
			if (!idToken.audience) {
				throw new InvalidRequestError("Invalid audience");
			}
			if (Array.isArray(idToken.audience)) {
				throw new InvalidRequestError("Invalid audience");
			}

			subjectId = idToken.subject;
			clientId = idToken.audience;

			// When client_id is provided with id_token_hint, verify they match
			if (args.clientId && args.clientId !== idToken.audience) {
				throw new InvalidRequestError("client_id does not match id_token_hint audience");
			}

			client = await this.repository.findClientById(idToken.audience);
		} else if (args.sessionSubject) {
			// No id_token_hint, but we have a session subject
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

		// Validate redirect URI if provided and client is known
		if (args.postLogoutRedirectUri && client) {
			if (client.logoutUri !== args.postLogoutRedirectUri) {
				throw new InvalidRequestError("Invalid redirect uri");
			}
		}

		// Only validate session subject if provided (user may not have auth server session)
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

	registerClient(_args: {
		clientId: string;
		clientSecret?: string;
		redirectUris?: string[];
		responseTypes?: string[];
		grantTypes?: string[];
		scope?: string;
		tokenEndpointAuthMethod?: "client_secret_basic" | "client_secret_post";
	}) {
		throw new Error("Client registration is not implemented");
	}

	override get wellKnown() {
		return super.wellKnown;
	}

	protected override async authorizationCodeGrant(args: {
		code: string;
		redirectUri: string;
		codeVerifier?: string;
		clientId?: string;
		clientSecret?: string;
	}) {
		let result = await super.authorizationCodeGrant(args);

		let accessToken = AccessToken.decode(result.access_token);

		let subject = await this.repository.findSubjectById(accessToken.subject);
		if (!subject) throw new InvalidGrantError("Subject not found");

		let authz = await this.repository.findAuthorizationCodeData(args.code);
		if (!authz) throw new InvalidGrantError("Code has expired or is invalid");

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

		return { ...result, id_token: idToken };
	}

	protected override async refreshTokenGrant(args: { refreshToken: string }) {
		let result = await super.refreshTokenGrant(args);

		let accessToken = AccessToken.decode(result.access_token);

		let subject = await this.repository.findSubjectById(accessToken.subject);
		if (!subject) throw new InvalidGrantError("Subject not found");

		let session = await this.repository.findSessionById(args.refreshToken);
		if (!session) {
			throw new InvalidGrantError("Invalid or expired refresh token");
		}

		// auth_time is the session creation time
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

		return { ...result, id_token: idToken };
	}
}

class CodeChallenge {
	private static async generate(verifier: string, method: "S256" | "plain") {
		if (method === "plain") return verifier;
		let encoder = new TextEncoder();
		let data = encoder.encode(verifier);
		let hash = await crypto.subtle.digest("SHA-256", data);
		return base64url.encode(new Uint8Array(hash));
	}

	static async validate(verifier: string, challenge: string, method: "S256" | "plain" = "S256") {
		let generatedChallenge = await CodeChallenge.generate(verifier, method);
		return generatedChallenge === challenge;
	}
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses Node.js crypto.timingSafeEqual which is available in Cloudflare Workers.
 */
function secureCompare(a: string, b: string): boolean {
	let encoder = new TextEncoder();
	let aBuffer = encoder.encode(a);
	let bBuffer = encoder.encode(b);

	// If lengths differ, compare a with itself to maintain constant time
	// but still return false
	if (aBuffer.length !== bBuffer.length) {
		timingSafeEqual(aBuffer, aBuffer);
		return false;
	}

	return timingSafeEqual(aBuffer, bBuffer);
}
