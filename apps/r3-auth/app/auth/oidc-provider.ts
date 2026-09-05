/**
 * The OAuth 2.0 / OpenID Connect engine: the authorization-code, refresh-token and
 * client-credentials grants, revocation, introspection, userinfo, PKCE, the password
 * login flow, and back-/front-channel logout. It talks only to an {@link OIDC.Repository},
 * so the protocol rules stay testable and independent of storage and of HTTP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url, Hex, password, randomBytes, sha256, timingSafeEqual } from "@sdxc/crypto";
import { elapsed } from "@sdxc/dates";
import { JWK, JWT } from "@sdxc/jwt";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import AccessToken from "~/app/auth/values/access-token";
import IdToken from "~/app/auth/values/id-token";
import LogoutToken from "~/app/auth/values/logout-token";

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
 * Clock tolerance for an `id_token_hint`. RP-Initiated Logout 1.0 treats the hint as a
 * pointer to the ending session, so a sign-out long after the token aged out still
 * works; signature, issuer and algorithm are what keep the hint trustworthy.
 */
const ID_TOKEN_HINT_CLOCK_TOLERANCE = Number.MAX_SAFE_INTEGER;

/**
 * Base class for every protocol failure, carrying the RFC 6749 error code and the
 * human-readable description an endpoint puts into its error envelope. Callers reach it
 * through `OIDC.Error`, so they match on the same objects the engine throws.
 */
class OAuth2Error extends globalThis.Error {
	override readonly name: string = "OAuth2Error";

	/**
	 * @param code - The `error` value to report, per RFC 6749.
	 * @param description - The `error_description` value to report.
	 */
	constructor(
		readonly code: string,
		readonly description: string,
	) {
		super(`OAuth2 error: ${code}`);
	}
}

/** The client could not be identified or its credentials did not check out. */
class InvalidClientError extends OAuth2Error {
	override readonly name = "InvalidClientError";

	constructor(override readonly description: string) {
		super("invalid_client", description);
	}
}

/** The grant (code, refresh token, session) is expired, unknown, or does not match the request. */
class InvalidGrantError extends OAuth2Error {
	override readonly name = "InvalidGrantError";

	constructor(override readonly description: string) {
		super("invalid_grant", description);
	}
}

/** The request is missing a required parameter or contradicts itself. */
class InvalidRequestError extends OAuth2Error {
	override readonly name = "InvalidRequestError";

	constructor(override readonly description: string) {
		super("invalid_request", description);
	}
}

/** A requested scope is unknown or outside what this client may request. */
class InvalidScopeError extends OAuth2Error {
	override readonly name = "InvalidScopeError";

	constructor(override readonly description: string) {
		super("invalid_scope", description);
	}
}

/** The client is known, and this operation is outside what it may do. */
class UnauthorizedClientError extends OAuth2Error {
	override readonly name = "UnauthorizedClientError";

	constructor(override readonly description: string = "Unauthorized client") {
		super("unauthorized_client", description);
	}
}

/** A `grant_type` outside the set this server implements. */
class UnsupportedGrantTypeError extends OAuth2Error {
	override readonly name = "UnsupportedGrantTypeError";

	constructor(override readonly description: string) {
		super("unsupported_grant_type", description);
	}
}

/** A `response_type` outside the set this server implements. */
class UnsupportedResponseTypeError extends OAuth2Error {
	override readonly name = "UnsupportedResponseTypeError";

	constructor(override readonly description: string) {
		super("unsupported_response_type", description);
	}
}

/** The person could not be authenticated, most often a wrong email or password. */
class AccessDeniedError extends OAuth2Error {
	override readonly name = "AccessDeniedError";

	constructor(override readonly description: string) {
		super("access_denied", description);
	}
}

/** The engine itself failed while handling a well-formed request. */
class InternalServerError extends OAuth2Error {
	override readonly name = "InternalServerError";

	constructor(override readonly description: string = "Internal server error") {
		super("internal_server_error", description);
	}
}

/** Sign-in is refused until the person verifies their email address. */
class MissingValidationError extends OAuth2Error {
	override readonly name = "MissingValidationError";

	constructor(override readonly description: string = "Verification required") {
		super("missing_validation", description);
	}
}

/**
 * The bearer access token presented at a protected endpoint is unusable — here, one that
 * was not issued with a scope the endpoint requires. Carries the `invalid_token` code
 * RFC 6750 §3.1 defines for the `WWW-Authenticate` challenge a bearer endpoint answers with.
 */
class InvalidTokenError extends OAuth2Error {
	override readonly name = "InvalidTokenError";

	constructor(override readonly description: string) {
		super("invalid_token", description);
	}
}

/** Absence is a legitimate answer from storage, so every boundary states it in the type. */
type Nullable<T> = T | null;

/**
 * What one back-channel logout delivery achieved. A relying party that answered and
 * refused the token stays apart from one that could not be reached, since a rejecting
 * deployment and a network fault call for different investigations.
 */
type BackchannelDelivery = { clientId: string; host: string | null } & (
	| { outcome: "delivered" }
	| { outcome: "refused"; status: number }
	| { outcome: "unreachable"; error: string }
);

/** Data shapes the engine exchanges with its storage layer and its callers. */
export namespace OIDC {
	/**
	 * Where the engine reports a failure it recovers from on its own, so a recovery
	 * that keeps failing stays visible while the request it happened on succeeds. The
	 * invocation's log satisfies it; a test hands in a recording double.
	 */
	export interface Log {
		/**
		 * @param name - Stable dotted event name, matched on when reading a record.
		 * @param fields - Flat scalar detail about the failure; carries no credential material.
		 */
		warn(
			name: string,
			fields?: Record<string, string | number | boolean | null | undefined>,
		): unknown;
	}

	/** A person who can sign in, reduced to the identity claims the engine needs. */
	export interface Subject {
		id: string;
		avatar: string;
		username: string;
		displayName: string;
		emailAddress: string;
		emailVerifiedAt: Date | null;
	}

	/** A subject's password credential. `verifiedAt` being `null` blocks sign-in outright. */
	export interface Credential {
		subjectId: string;
		passwordHash: string;
		verifiedAt: Date | null;
	}

	/** A recorded consent: this subject authorized this client. */
	export interface Grant {
		id: string;
		subjectId: string;
		clientId: string;
	}

	/**
	 * A session joined to its client's logout configuration, which is what the logout
	 * fan-out needs to decide whom to notify and whether to name the session.
	 */
	export interface SessionWithClient {
		sessionId: string;
		clientId: string;
		backchannelLogoutUri: string | null;
		backchannelLogoutSessionRequired: string | null;
		frontchannelLogoutUri: string | null;
		frontchannelLogoutSessionRequired: string | null;
	}

	/**
	 * A session whose client registered a back-channel logout endpoint, which is what
	 * makes it a recipient of a logout token.
	 */
	export interface BackchannelRecipient extends Omit<SessionWithClient, "backchannelLogoutUri"> {
		backchannelLogoutUri: string;
	}

	/**
	 * A session whose client registered a front-channel logout endpoint, which is what
	 * earns it an iframe in the logout page.
	 */
	export interface FrontchannelRecipient extends Omit<SessionWithClient, "frontchannelLogoutUri"> {
		frontchannelLogoutUri: string;
	}

	/**
	 * Everything the engine needs from storage. Implementations own the database and the
	 * key access; the engine keeps to the protocol rules.
	 */
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

		/**
		 * Resolves a registered post-logout address to a client by exact equality on the
		 * stored logout URI, or `null` when nobody registered it. It answers only whether
		 * the address is registered, so a shared one resolves to any single stable client.
		 */
		findClientByLogoutUri(logoutUri: string): Promise<
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
				scope: string[];
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

		findSubjectByEmail(email: string): Promise<Nullable<Subject>>;
		createSubject(data: {
			emailAddress: string;
			displayName: string;
			username: string;
			avatar: string;
		}): Promise<Subject>;

		findCredential(subjectId: string): Promise<Nullable<Credential>>;
		/**
		 * Stores a password credential for a subject.
		 *
		 * @param verifiedAt - When the credential became usable, or `null` to store it
		 *   refused: a `null` here is what {@link MissingValidationError} reports at the
		 *   next sign-in, so it must only be passed for a credential whose owner has not
		 *   been established.
		 */
		createCredential(
			subjectId: string,
			passwordHash: string,
			verifiedAt: Nullable<Date>,
		): Promise<void>;
		/**
		 * Replaces the stored hash for a subject that already has a credential. Called
		 * after a password verified, to retire a hash written under an older scheme; it
		 * updates an existing row only, since a missing credential means no password yet.
		 */
		updateCredentialPasswordHash(subjectId: string, passwordHash: string): Promise<void>;

		createSession(
			subjectId: string,
			clientId: string,
			ip: string | null,
			ua: string | null,
			scope: string[],
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

		findSessionsForBackchannelLogout(
			subjectId: string,
			excludeClientId?: string,
		): Promise<SessionWithClient[]>;

		findSessionsForFrontchannelLogout(
			subjectId: string,
			excludeClientId?: string,
		): Promise<SessionWithClient[]>;
	}

	/** A PKCE challenge (RFC 7636), bound to a code so only its issuer can redeem it. */
	export interface Pkce {
		challenge: string;
		method: "S256" | "plain";
	}

	/** The authorization request an issued code has to carry back to the relying party. */
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
		/**
		 * The challenge the client committed to on the authorization request, stored with
		 * the code so redeeming it requires the matching verifier. `null` or absent leaves
		 * the code redeemable on its own, for clients that skip PKCE.
		 */
		pkce?: Pkce | null;
	}

	/** A password sign-in attempt, plus the authorization request it resumes on success. */
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
		/** The PKCE challenge to bind to the code this sign-in issues, when the client sent one. */
		pkce?: Pkce | null;
	}

	/** Where to send the browser next, and with which parameters, after issuing a code. */
	export interface AuthzCodeResult {
		redirectUri: string;
		params: Record<string, string>;
		responseMode: "query" | "fragment" | "form_post";
		subjectId: string;
	}

	/** One relying party's front-channel logout URL, ready to be loaded in a hidden iframe. */
	export interface FrontchannelLogoutUrl {
		clientId: string;
		url: string;
	}
}

/**
 * The authorization server's protocol engine. One instance is built per issuer over a
 * repository; every endpoint delegates its rules here.
 */
export class OIDC {
	/**
	 * Base class of every failure the engine throws, so a caller can catch the whole
	 * family and read `code`/`description` straight into an OAuth error envelope.
	 */
	static Error = OAuth2Error;
	/** Unknown client, or client credentials that did not check out. */
	static InvalidClientError = InvalidClientError;
	/** Expired, unknown, or mismatched code, refresh token or session. */
	static InvalidGrantError = InvalidGrantError;
	/** Missing or contradictory request parameters. */
	static InvalidRequestError = InvalidRequestError;
	/** A scope outside what this server grants. */
	static InvalidScopeError = InvalidScopeError;
	/** A known client attempting something outside its permissions. */
	static UnauthorizedClientError = UnauthorizedClientError;
	/** A `grant_type` outside what this server implements. */
	static UnsupportedGrantTypeError = UnsupportedGrantTypeError;
	/** A `response_type` outside what this server implements. */
	static UnsupportedResponseTypeError = UnsupportedResponseTypeError;
	/** Authentication was refused, typically wrong credentials. */
	static AccessDeniedError = AccessDeniedError;
	/** The engine itself failed while handling a well-formed request. */
	static InternalServerError = InternalServerError;
	/** Sign-in blocked pending email verification. */
	static MissingValidationError = MissingValidationError;
	/** A bearer token that is unusable at a protected endpoint, e.g. missing a required scope. */
	static InvalidTokenError = InvalidTokenError;

	/** The access-token value object, exposed so callers verify tokens with the same class the engine mints. */
	static AccessToken = AccessToken;

	/** The ID-token value object, exposed so callers decode tokens with the same class the engine mints. */
	static IdToken = IdToken;

	/**
	 * @param issuer - The `iss` value written into tokens and compared when verifying them.
	 * @param repository - Storage and signing keys the engine reads and writes through.
	 * @param log - Where the failures the engine recovers from while answering a request are recorded.
	 */
	constructor(
		private issuer: string,
		private repository: OIDC.Repository,
		private log: OIDC.Log,
	) {}

	/**
	 * Runs one of the three supported grants and returns its token response. Failures
	 * are thrown: each is a protocol error a controller turns into an OAuth error
	 * envelope, and the thrown class carries the exact `error` code to report.
	 *
	 * @param args - The grant to run, discriminated by `type`.
	 * @throws {OAuth2Error} For any protocol failure, including an unknown grant type.
	 */
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

	/**
	 * Revokes a refresh token by deleting the session it names (RFC 7009). An unknown
	 * token succeeds silently, as the specification requires, so a client cannot probe
	 * which tokens exist; an access-token hint is ignored, as those expire on their own.
	 *
	 * @throws {InvalidClientError} When the client credentials do not check out.
	 * @throws {UnauthorizedClientError} When the token belongs to a different client.
	 */
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

	/**
	 * Reports whether a token is currently usable, and its claims when it is (RFC 7662).
	 * A token that fails to resolve is reported inactive, so introspection stays silent
	 * about the reason; a key store that cannot answer is reported as this server failing.
	 *
	 * @returns The token's claims, with an identifier a token predates — such as the
	 * `client_id` claim — reported as absent, which keeps that token usable for the rest
	 * of its lifetime.
	 * @throws {InvalidClientError} When the client credentials do not check out.
	 * @throws {InternalServerError} When the signing keys are unavailable, so the answer
	 * describes this server as the reason.
	 */
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
				client_id?: string;
				exp: number;
				iat: number;
				iss: string;
				aud?: string | string[];
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

		let signingKeys = await wrap(() => this.repository.getSigningKey());

		if (isFailure(signingKeys)) {
			this.log.warn("oidc.introspect.signing_key_failed", {
				clientId: args.clientId,
				error: signingKeys.error.message,
			});

			throw new InternalServerError();
		}

		let accessToken = await wrap(() =>
			AccessToken.verify(args.token, signingKeys.data, {
				issuer: this.issuer,
				algorithms: [JWK.Algorithm.ES256],
			}),
		);

		if (isFailure(accessToken)) return { active: false };

		return {
			active: true,
			sub: accessToken.data.subject,
			client_id: accessToken.data.clientId ?? undefined,
			exp: accessToken.data.expirationTime,
			iat: Math.floor(accessToken.data.issuedAt.getTime() / 1000),
			iss: accessToken.data.issuer,
			aud: accessToken.data.audience ?? undefined,
			token_type: "Bearer",
		};
	}

	/**
	 * Resolves a bearer access token to its subject and the scopes it was granted, so
	 * the caller decides which claims each scope entitles the client to. Requiring
	 * `openid` limits the answer to tokens issued on behalf of an end user.
	 *
	 * @throws When the token fails signature, issuer or expiry verification.
	 * @throws {InvalidTokenError} When the token was not issued with the `openid` scope.
	 * @throws {InternalServerError} When the signing keys are unavailable, so the answer
	 * names this server as the reason.
	 */
	async userinfo(args: { accessToken: string; clientId?: string }) {
		let signingKeys = await wrap(() => this.repository.getSigningKey());

		if (isFailure(signingKeys)) {
			this.log.warn("oidc.userinfo.signing_key_failed", { error: signingKeys.error.message });

			throw new InternalServerError();
		}

		let accessToken = await AccessToken.verify(args.accessToken, signingKeys.data, {
			issuer: this.issuer,
			algorithms: [JWK.Algorithm.ES256],
		});

		let scope = accessToken.scopes;
		if (!scope.includes("openid")) {
			throw new InvalidTokenError("The access token was not issued with the openid scope");
		}

		let subject = await this.repository.findSubjectById(accessToken.subject);

		return { subject, scope };
	}

	/**
	 * Ends every session the subject holds, so sign-out is global across relying parties. Only an
	 * exact match with a registered logout URI becomes the redirect, and the parties to notify are
	 * read while their rows still exist.
	 *
	 * @returns The subject logged out, the initiating client, the verified redirect to honor if any, and whom to notify.
	 * @throws {InvalidRequestError} When the hint is unusable, neither hint nor session is given, or a parameter contradicts the hint.
	 */
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
			let hinted = await this.subjectAndClientFromIdTokenHint(args.idTokenHint, args.clientId);

			subjectId = hinted.subjectId;
			clientId = hinted.clientId;
			client = await this.repository.findClientById(hinted.clientId);
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

		let redirectUri: string | undefined;

		if (args.postLogoutRedirectUri) {
			let registrant =
				client?.logoutUri === args.postLogoutRedirectUri
					? client
					: await this.repository.findClientByLogoutUri(args.postLogoutRedirectUri);

			if (registrant) redirectUri = args.postLogoutRedirectUri;
		}

		if (args.sessionSubject && args.sessionSubject !== subject.id) {
			throw new InvalidRequestError("Invalid session subject");
		}

		let [backchannelSessions, frontchannelSessions] = await Promise.all([
			this.repository.findSessionsForBackchannelLogout(subject.id, clientId),
			this.repository.findSessionsForFrontchannelLogout(subject.id, clientId),
		]);

		await this.repository.deleteSessionBySubjectId(subject.id);

		return {
			subjectId: subject.id,
			clientId,
			redirectUri,
			backchannelSessions,
			frontchannelUrls: this.buildFrontchannelLogoutUrls(frontchannelSessions),
		};
	}

	/**
	 * A refusal records the reason verification failed, so a cause shared by every client — a
	 * retired signing key, say — stays legible behind the single answer the specification allows.
	 * A hint whose audience contradicts the request's `client_id` is refused too.
	 *
	 * @param hint - The `id_token_hint` as received.
	 * @param requestedClientId - The `client_id` the request carried, recorded with a refusal.
	 * @returns The subject the hint identifies and the relying party it was issued to.
	 * @throws {InvalidRequestError} When verification fails, the hint names no single subject and audience, or its audience contradicts `client_id`.
	 */
	private async subjectAndClientFromIdTokenHint(
		hint: string,
		requestedClientId?: string,
	): Promise<{ subjectId: string; clientId: string }> {
		let signingKeys = await this.repository.getSigningKey();

		let verified = await wrap(() =>
			IdToken.verify(hint, signingKeys, {
				issuer: this.issuer,
				algorithms: [JWK.Algorithm.ES256],
				clockTolerance: ID_TOKEN_HINT_CLOCK_TOLERANCE,
			}),
		);

		if (isFailure(verified)) {
			this.log.warn("oidc.logout.hint_verification_failed", {
				clientId: requestedClientId,
				error: verified.error.message,
			});

			throw new InvalidRequestError("Invalid id_token_hint");
		}

		let idToken = verified.data;

		if (!idToken.subject) throw new InvalidRequestError("Invalid subject");
		if (!idToken.audience) throw new InvalidRequestError("Invalid audience");
		if (Array.isArray(idToken.audience)) throw new InvalidRequestError("Invalid audience");

		if (requestedClientId && requestedClientId !== idToken.audience) {
			throw new InvalidRequestError("client_id does not match id_token_hint audience");
		}

		return { subjectId: idToken.subject, clientId: idToken.audience };
	}

	/**
	 * Opens a session, records consent, and issues a single-use authorization code for
	 * the relying party to redeem. A failure becomes an `error=` parameter on the client's
	 * redirect URI, so it carries a fixed description and reports its detail to the log.
	 *
	 * @param input - The subject, client, and authorization request being answered.
	 * @returns The redirect carrying the code, or the failure to redirect in its place.
	 */
	async generateAuthzCode(input: OIDC.GenerateAuthzCodeInput) {
		let issued = await wrap(async () => {
			let authTime = Math.floor(Date.now() / 1000);

			let [session, _grant] = await Promise.all([
				this.repository.createSession(
					input.subjectId,
					input.clientId,
					input.ip,
					input.ua,
					input.scope ?? ["openid"],
				),
				this.repository.findOrCreateGrant(input.subjectId, input.clientId),
			]);

			let code = crypto.randomUUID();
			await this.repository.storeAuthorizationCode(code, {
				clientId: input.clientId,
				subjectId: input.subjectId,
				sessionId: session.id,
				pkce: input.pkce ?? null,
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

			return {
				redirectUri: input.redirectUri,
				params,
				responseMode: input.responseMode ?? "query",
				subjectId: input.subjectId,
			};
		});

		if (isFailure(issued)) {
			this.log.warn("oidc.authorize.code_issue_failed", {
				clientId: input.clientId,
				subjectId: input.subjectId,
				error: issued.error.message,
			});

			return failure(new InternalServerError());
		}

		return success(issued.data);
	}

	/**
	 * Signs a subject in with an email and password, issuing an authorization code. An
	 * unknown address registers with a verified credential, so signing up ends signed in;
	 * a known address without one stores an unverified hash, so a stranger cannot claim it.
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

				await this.repository.createCredential(subject.id, passwordHash.data, null);
				return failure(new MissingValidationError("Verify your email address."));
			}

			if (credential.verifiedAt === null) {
				return failure(new MissingValidationError("Verify your email address."));
			}

			let passwordValid = await password.verify(credential.passwordHash, input.password);
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

			await this.repository.createCredential(subject.id, passwordHash.data, new Date());
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
			pkce: input.pkce,
		});
	}

	/**
	 * Completes a social sign-in whose identity has already been resolved to a subject.
	 *
	 * Identical to issuing a code directly — the provider handshake happens outside the
	 * engine — and exists so the login controllers read the same either way.
	 */
	async loginWithProvider(input: OIDC.GenerateAuthzCodeInput) {
		return await this.generateAuthzCode(input);
	}

	/**
	 * Notifies every relying party with a back-channel logout URI that a subject signed out,
	 * skipping the client that initiated the logout. Reaching them is best effort throughout —
	 * reading them included — and every failure is reported, so the sign-out still completes.
	 */
	async sendBackchannelLogoutTokens(subjectId: string, excludeClientId?: string): Promise<void> {
		let sessions = await wrap(() =>
			this.repository.findSessionsForBackchannelLogout(subjectId, excludeClientId),
		);

		if (isFailure(sessions)) {
			this.log.warn("oidc.logout.backchannel_lookup_failed", {
				subjectId,
				error: sessions.error.message,
			});

			return;
		}

		await this.deliverBackchannelLogoutTokens(subjectId, sessions.data);
	}

	/**
	 * Delivers back-channel logout tokens to an already-collected set of sessions, since
	 * the RP-initiated flow reads them before deleting them. Every recipient is attempted,
	 * each failure is reported, and the person's sign-out completes on its own terms.
	 *
	 * @param sessions - Sessions to notify, already filtered to exclude the initiating client.
	 */
	async deliverBackchannelLogoutTokens(
		subjectId: string,
		sessions: OIDC.SessionWithClient[],
	): Promise<void> {
		let recipients = sessions.filter(
			(session): session is OIDC.BackchannelRecipient => session.backchannelLogoutUri !== null,
		);

		if (recipients.length === 0) return;

		let signingKeys = await wrap(() => this.repository.getSigningKey());

		if (isFailure(signingKeys)) {
			this.log.warn("oidc.logout.backchannel_signing_failed", {
				subjectId,
				recipient_count: recipients.length,
				error: signingKeys.error.message,
			});

			return;
		}

		let keys = signingKeys.data;

		let deliveries = await Promise.all(
			recipients.map((recipient) => this.deliverBackchannelLogoutToken(subjectId, recipient, keys)),
		);

		for (let delivery of deliveries) {
			if (delivery.outcome === "refused") {
				this.log.warn("oidc.logout.backchannel_refused", {
					subjectId,
					clientId: delivery.clientId,
					host: delivery.host,
					status: delivery.status,
				});
			}

			if (delivery.outcome === "unreachable") {
				this.log.warn("oidc.logout.backchannel_unreachable", {
					subjectId,
					clientId: delivery.clientId,
					host: delivery.host,
					error: delivery.error,
				});
			}
		}
	}

	/**
	 * Sends one relying party its logout token and answers with what the endpoint did,
	 * settling for every outcome so each recipient's fate stays its own.
	 *
	 * @param recipient - The session to notify, joined to its client's logout configuration.
	 * @param signingKeys - Keys the logout token is signed with.
	 */
	private async deliverBackchannelLogoutToken(
		subjectId: string,
		recipient: OIDC.BackchannelRecipient,
		signingKeys: JWK.KeyPair[],
	): Promise<BackchannelDelivery> {
		let clientId = recipient.clientId;
		let host = endpointHost(recipient.backchannelLogoutUri);

		let response = await wrap(async () => {
			let sessionId =
				recipient.backchannelLogoutSessionRequired === "true" ? recipient.sessionId : undefined;

			let logoutToken = LogoutToken.generate(subjectId, clientId, sessionId);
			let signedToken = await logoutToken.sign(JWK.Algorithm.ES256, signingKeys);

			return await fetch(recipient.backchannelLogoutUri, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ logout_token: signedToken }),
			});
		});

		if (isFailure(response)) {
			return { clientId, host, outcome: "unreachable", error: response.error.message };
		}

		if (!response.data.ok) {
			return { clientId, host, outcome: "refused", status: response.data.status };
		}

		return { clientId, host, outcome: "delivered" };
	}

	/**
	 * Builds the front-channel logout URLs to load in hidden iframes, one per relying
	 * party that registered one, skipping the initiating client. `sid` rides along for
	 * clients that asked for session-specific logout, keeping ids with their own client.
	 */
	async getFrontchannelLogoutUrls(
		subjectId: string,
		excludeClientId?: string,
	): Promise<OIDC.FrontchannelLogoutUrl[]> {
		let sessions = await this.repository.findSessionsForFrontchannelLogout(
			subjectId,
			excludeClientId,
		);

		return this.buildFrontchannelLogoutUrls(sessions);
	}

	/**
	 * Turns already-collected sessions into the iframe URLs the browser loads, so the flow
	 * builds the list from sessions it read before deleting them. A stored address that fails
	 * to parse is reported and skipped, so one client's configuration ends only its own frame.
	 *
	 * @param sessions - Sessions to notify, already filtered to exclude the initiating client.
	 */
	private buildFrontchannelLogoutUrls(
		sessions: OIDC.SessionWithClient[],
	): OIDC.FrontchannelLogoutUrl[] {
		let recipients = sessions.filter(
			(session): session is OIDC.FrontchannelRecipient => session.frontchannelLogoutUri !== null,
		);

		let urls: OIDC.FrontchannelLogoutUrl[] = [];

		for (let recipient of recipients) {
			let logoutUrl = wrap(() => new URL(recipient.frontchannelLogoutUri));

			if (isFailure(logoutUrl)) {
				this.log.warn("oidc.logout.frontchannel_uri_invalid", {
					clientId: recipient.clientId,
					error: logoutUrl.error.message,
				});

				continue;
			}

			logoutUrl.data.searchParams.set("iss", `https://${this.issuer}`);

			if (recipient.frontchannelLogoutSessionRequired === "true") {
				logoutUrl.data.searchParams.set("sid", recipient.sessionId);
			}

			urls.push({
				clientId: recipient.clientId,
				url: logoutUrl.data.toString(),
			});
		}

		return urls;
	}

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

	/** The engine's share of the discovery document: what this instance can actually do. */
	get wellKnown() {
		return {
			issuer: this.issuer,
			code_challenge_methods_supported: ["S256", "plain"],
			id_token_signing_alg_values_supported: [JWK.Algorithm.ES256],
			request_parameter_supported: false,
			request_uri_parameter_supported: false,
			response_types_supported: ["code", "token"],
			scopes_supported: [] as string[],
		};
	}

	/** The public JWKS for the current signing keys, as relying parties fetch it. */
	get jwks() {
		return this.repository.getSigningKey().then(JWK.toJSON);
	}

	/**
	 * Redeems an authorization code. A refresh token rides along only for a request that
	 * asked for `offline_access` (OIDC Core §11), and the response names the scope it
	 * granted, so a client whose request was narrowed can see that (RFC 6749 §3.3).
	 */
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
				let matches = await CodeChallenge.validate(args.codeVerifier, pkce.challenge, pkce.method);

				if (isFailure(matches)) {
					this.log.warn("oidc.token.pkce_digest_failed", {
						clientId,
						error: matches.error.message,
					});

					throw new InternalServerError();
				}

				if (!matches.data) throw new InvalidGrantError("PKCE validation failed");
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

		let accessToken = await this.signJWT(
			AccessToken.generate({
				audience: clientId,
				subjectId,
				clientId,
				scope: authz.scope,
			}),
		);

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
			...(authz.scope.includes("offline_access") && { refresh_token: sessionId }),
			expires_in: AccessToken.ttl,
			id_token: idToken,
			scope: authz.scope.join(" "),
		};
	}

	/**
	 * Issues a service access token to a client acting for itself. No resource owner takes
	 * part, so RFC 9068 §2.2.1 has `sub` name the client, and that is what marks the token
	 * as a service one downstream.
	 */
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
			AccessToken.generate({
				audience: [this.issuer, ...args.resource],
				subjectId: args.clientId,
				clientId: args.clientId,
			}),
		);

		return {
			access_token: accessToken,
			token_type: "Bearer" as const,
			expires_in: AccessToken.ttl,
		};
	}

	/**
	 * Reissues access and id tokens with the scope the session was originally granted,
	 * so a refresh does not drop the claims sensitive to `scope` (e.g. `picture`, `name`)
	 * that the client got at sign-in.
	 */
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

		let accessToken = await this.signJWT(
			AccessToken.generate({
				audience: session.clientId,
				subjectId: session.subjectId,
				clientId: session.clientId,
				scope: session.scope,
			}),
		);

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
				{ authTime, scope: session.scope },
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

	private async signJWT(jwt: JWT) {
		return await jwt.sign(JWK.Algorithm.ES256, await this.repository.getSigningKey());
	}

	/**
	 * Replaces a stored hash that is behind current policy, at the one moment the plaintext
	 * exists: a successful sign-in. Correct credentials authenticate even when the upgrade
	 * fails, and every failure is reported, so a migration stuck on one is visible.
	 *
	 * @param subjectId - Owner of the credential being upgraded, and the only identifier logged.
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
		if (isFailure(rehashed)) {
			this.log.warn("auth.password_rehash_failed", {
				subjectId,
				error: rehashed.error.message,
			});
			return;
		}

		let written = await wrap(() =>
			this.repository.updateCredentialPasswordHash(subjectId, rehashed.data),
		);

		if (isFailure(written)) {
			this.log.warn("auth.password_rehash_write_failed", {
				subjectId,
				error: written.error.message,
			});
		}
	}
}

/** PKCE code challenge derivation and checking (RFC 7636). */
class CodeChallenge {
	/**
	 * Derives the challenge a verifier produces under a method: the unpadded
	 * base64url SHA-256 for `S256`, and the verifier itself for `plain`.
	 *
	 * @param verifier - The `code_verifier` presented at the token endpoint.
	 * @param method - The method recorded with the authorization code.
	 * @returns The derived challenge, or the reason the runtime refused the digest.
	 */
	private static async generate(
		verifier: string,
		method: "S256" | "plain",
	): Promise<Result<string, Error>> {
		if (method === "plain") return success(verifier);

		let digest = await sha256(verifier);
		if (isFailure(digest)) return digest;

		return success(Base64Url.encode(digest.data));
	}

	/**
	 * Checks a verifier against the stored challenge. A grant passes only on a proven
	 * match, and a digest the runtime refuses is reported as its own failure, which keeps
	 * a fault in this server distinct from a verifier that does not match.
	 *
	 * @param verifier - The `code_verifier` presented at the token endpoint.
	 * @param challenge - The `code_challenge` stored with the authorization code.
	 * @param method - The challenge method; defaults to `S256`.
	 * @returns Whether the verifier derives exactly the stored challenge, or the reason
	 * the derivation could not be performed.
	 */
	static async validate(
		verifier: string,
		challenge: string,
		method: "S256" | "plain" = "S256",
	): Promise<Result<boolean, Error>> {
		let generatedChallenge = await CodeChallenge.generate(verifier, method);
		if (isFailure(generatedChallenge)) return generatedChallenge;

		return success(timingSafeEqual(generatedChallenge.data, challenge));
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
 * Names an outbound endpoint by host alone, which is what ties a delivery failure to a
 * relying party's deployment while the rest of the address stays out of the logs.
 *
 * @returns The host, or `null` for an address that no longer parses as a URL.
 */
function endpointHost(uri: string): string | null {
	let url = wrap(() => new URL(uri));

	return isFailure(url) ? null : url.data.host;
}
