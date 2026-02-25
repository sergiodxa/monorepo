import { JWK, JWT } from "@edgefirst-dev/jwt";
import { isBefore } from "date-fns";
import { base64url } from "jose";

import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";
import {
	InvalidClientError,
	InvalidGrantError,
	InvalidRequestError,
	OAuth2Error,
	UnauthorizedClientError,
	UnsupportedGrantTypeError,
} from "../errors";

export { OAuth2Error };

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
			}>
		>;

		findAuthorizationCodeData(code: string): Promise<{
			clientId: string;
			subjectId: string;
			sessionId: string;
			pkce: { challenge: string; method: "S256" | "plain" } | null;
			nonce: string | null;
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
		// Validate client credentials
		let client = await this.repository.findClientById(args.clientId);
		if (!client || client.secret !== args.clientSecret) {
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
		// Validate client credentials
		let client = await this.repository.findClientById(args.clientId);
		if (!client || client.secret !== args.clientSecret) {
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

		let accessToken = await this.signJWT(AccessToken.generate(clientId, subjectId));

		return {
			access_token: accessToken,
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

		if (client.secret !== args.clientSecret) {
			throw new InvalidClientError("Client is not registered");
		}

		let accessToken = await this.signJWT(
			AccessToken.generate([this.issuer, ...args.resource], args.clientId),
		);

		return { expires_in: AccessToken.ttl, access_token: accessToken };
	}

	protected async refreshTokenGrant(args: { refreshToken: string }) {
		let session = await this.repository.findSessionById(args.refreshToken);
		if (!session) {
			throw new InvalidGrantError("Invalid or expired refresh token");
		}

		let client = await this.repository.findClientById(session.clientId);

		if (!client) throw new InvalidClientError("Client is not registered");

		// Update session's last activity timestamp
		await this.repository.touchSession(session.id);

		let accessToken = await this.signJWT(AccessToken.generate(session.clientId, session.subjectId));

		return {
			expires_in: AccessToken.ttl,
			access_token: accessToken,
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
	async userinfo(args: { accessToken: string; clientId?: string }) {
		let accessToken = await AccessToken.verify(
			args.accessToken,
			await this.repository.getSigningKey(),
			{ issuer: this.issuer },
		);

		let subject = await this.repository.findSubjectById(accessToken.subject);

		return subject;
	}

	async logout(args: {
		idTokenHint: string;
		postLogoutRedirectUri?: string;
		sessionSubject?: string;
	}) {
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

		let [client, subject] = await Promise.all([
			this.repository.findClientById(idToken.audience),
			this.repository.findSubjectById(idToken.subject),
		]);

		if (!subject) throw new InvalidRequestError("Invalid subject");
		if (!client) throw new InvalidRequestError("Invalid audience");

		if (args.postLogoutRedirectUri && client.logoutUri !== args.postLogoutRedirectUri) {
			throw new InvalidRequestError("Invalid redirect uri");
		}

		// Only validate session subject if provided (user may not have auth server session)
		if (args.sessionSubject && args.sessionSubject !== subject.id) {
			throw new InvalidRequestError("Invalid session subject");
		}

		await this.repository.deleteSessionBySubjectId(subject.id);

		return { subjectId: subject.id, redirectUri: args.postLogoutRedirectUri };
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
				{ nonce: authz.nonce }, // Echo back nonce from authorization request
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
