/**
 * Core OAuth 2.0 / OIDC provider for the auth app. Implements the token,
 * revoke, introspect, userinfo, and logout endpoints plus the authorization-
 * code, refresh-token, and client-credentials grants, PKCE and login flows, and
 * back-/front-channel logout, working against a pluggable repository interface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { timingSafeEqual } from "node:crypto";

import { JWK, JWT } from "@edgefirst-dev/jwt";
import { failure, success } from "@pkg/result";
import bcrypt from "bcryptjs";
import { isBefore } from "date-fns";
import { base64url } from "jose";

import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";
import LogoutToken from "../entities/logout-token";

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

		findAuthorizationCodeData(code: string): Promise<{
			clientId: string;
			subjectId: string;
			sessionId: string;
			pkce: { challenge: string; method: "S256" | "plain" } | null;
			nonce: string | null;
			scope: string[];
			authTime?: number;
		}>;

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
		if (!client || !secureCompare(client.secret, args.clientSecret)) {
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
		if (!client || !secureCompare(client.secret, args.clientSecret)) {
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

	async loginWithCredential(input: OIDC.LoginWithCredentialInput) {
		let subject = await this.repository.findSubjectByEmail(input.email);

		if (subject) {
			let credential = await this.repository.findCredential(subject.id);

			if (!credential) {
				let passwordHash = await bcrypt.hash(input.password, 10);
				await this.repository.createCredential(subject.id, passwordHash);
				return failure(new MissingValidationError("Verify your email address."));
			}

			if (credential.verifiedAt === null) {
				return failure(new MissingValidationError("Verify your email address."));
			}

			let passwordValid = await bcrypt.compare(input.password, credential.passwordHash);
			if (!passwordValid) {
				return failure(new AccessDeniedError("Invalid email or password."));
			}
		} else {
			let emailHash = await this.sha256(input.email);

			subject = await this.repository.createSubject({
				emailAddress: input.email,
				displayName: input.name,
				avatar: `https://gravatar.com/avatar/${emailHash}`,
				username: input.username,
			});

			let passwordHash = await bcrypt.hash(input.password, 10);
			await this.repository.createCredential(subject.id, passwordHash);

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

	async generateSessionState(
		clientId: string,
		redirectUri: string,
		opBrowserState: string,
	): Promise<string> {
		let origin = new URL(redirectUri).origin;
		let salt = this.generateSalt();
		let input = `${clientId} ${origin} ${opBrowserState} ${salt}`;
		let hash = await this.sha256(input);
		return `${hash}.${salt}`;
	}

	generateOpBrowserState(): string {
		let array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
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
		if (isBefore(session.expiresAt, new Date())) {
			throw new InvalidGrantError("Session has expired");
		}

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

	private async refreshTokenGrant(args: { refreshToken: string }) {
		let session = await this.repository.findSessionById(args.refreshToken);
		if (!session) {
			throw new InvalidGrantError("Invalid or expired refresh token");
		}

		if (isBefore(session.expiresAt, new Date())) {
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

	private generateSalt(): string {
		let array = new Uint8Array(16);
		crypto.getRandomValues(array);
		return Array.from(array)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	private async sha256(message: string): Promise<string> {
		let encoder = new TextEncoder();
		let data = encoder.encode(message);
		let hashBuffer = await crypto.subtle.digest("SHA-256", data);
		let hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}
}

// Keep OIDCProvider as an alias for backward compatibility
export { OIDC as OIDCProvider };

// =============================================================================
// Helper Classes
// =============================================================================

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

function secureCompare(a: string, b: string): boolean {
	let encoder = new TextEncoder();
	let aBuffer = encoder.encode(a);
	let bBuffer = encoder.encode(b);

	if (aBuffer.length !== bBuffer.length) {
		timingSafeEqual(aBuffer, aBuffer);
		return false;
	}

	return timingSafeEqual(aBuffer, bBuffer);
}
