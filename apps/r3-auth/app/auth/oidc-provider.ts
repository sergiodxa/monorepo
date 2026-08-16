/**
 * The OAuth 2.0 / OpenID Connect engine: the authorization-code, refresh-token and
 * client-credentials grants, revocation, introspection, userinfo, PKCE, the password
 * login flow, and back-/front-channel logout. It talks only to an {@link OIDC.Repository},
 * so the protocol rules stay testable and independent of storage and of HTTP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, Hex, password, randomBytes, sha256, timingSafeEqual } from "@pkg/crypto";
import { elapsed } from "@pkg/dates";
import { JWK, JWT } from "@pkg/jwt";
import { failure, isFailure, success } from "@pkg/result";

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
 * Clock tolerance applied when checking an `id_token_hint`, wide enough that no
 * time-based claim in it can ever fail.
 *
 * Expiry is deliberately not checked there. OpenID Connect RP-Initiated Logout 1.0
 * defines `id_token_hint` as a hint about which session is ending, not as a credential
 * that authenticates the request, and says the OP SHOULD accept an ID token whose `exp`
 * has passed. Somebody signing out long after their token aged out is the ordinary case,
 * and refusing it makes the end-session endpoint unusable for exactly the relying parties
 * that behave correctly.
 *
 * What makes the hint trustworthy is the signature, the issuer and the algorithm, all of
 * which stay checked. This tolerance is for the logout hint alone: every other ID token
 * this server verifies is authenticating somebody, and its expiry is enforced.
 */
const ID_TOKEN_HINT_CLOCK_TOLERANCE = Number.MAX_SAFE_INTEGER;

// =============================================================================
// Errors
// =============================================================================

/**
 * Base class for every protocol failure, carrying the RFC 6749 error code and the
 * human-readable description an endpoint puts into its error envelope.
 *
 * Reached through `OIDC.Error` and its named subclasses rather than imported, so a
 * caller matches on the same objects the engine throws.
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

/** A requested scope is unknown or not allowed for this client. */
class InvalidScopeError extends OAuth2Error {
	override readonly name = "InvalidScopeError";

	constructor(override readonly description: string) {
		super("invalid_scope", description);
	}
}

/** The client is known but not allowed to perform this operation. */
class UnauthorizedClientError extends OAuth2Error {
	override readonly name = "UnauthorizedClientError";

	constructor(override readonly description: string = "Unauthorized client") {
		super("unauthorized_client", description);
	}
}

/** The requested `grant_type` is not one this server implements. */
class UnsupportedGrantTypeError extends OAuth2Error {
	override readonly name = "UnsupportedGrantTypeError";

	constructor(override readonly description: string) {
		super("unsupported_grant_type", description);
	}
}

/** The requested `response_type` is not one this server implements. */
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

/** The engine failed for a reason that is not the caller's fault. */
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

// =============================================================================
// Types
// =============================================================================

/** A value the storage layer may legitimately not have, kept explicit at every boundary. */
type Nullable<T> = T | null;

/** Data shapes the engine exchanges with its storage layer and its callers. */
export namespace OIDC {
	/** A person who can sign in, as the engine needs them: identity claims and nothing else. */
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
	 * Everything the engine needs from storage. Implementations own the database and
	 * key access; the engine owns the protocol rules and never sees either.
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
		 * Resolves a registered post-logout address to the client that registered it, by
		 * exact equality on the stored logout URI, or `null` when nobody registered it.
		 *
		 * It answers one question — is this address registered — so an address more than
		 * one client registered is answered with any one of them, as long as the same one
		 * is returned every time. The answer is never treated as the client that started
		 * the logout, so an ambiguous match cannot drop a relying party from the fan-out.
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
		 * The challenge the client committed to on the authorization request, stored
		 * with the code so redeeming it requires the matching verifier. Absent or
		 * `null` for a client that does not use PKCE, whose code then redeems without
		 * a verifier exactly as before.
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

// =============================================================================
// OIDC Provider Class
// =============================================================================

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
	/** A scope this server does not grant. */
	static InvalidScopeError = InvalidScopeError;
	/** A known client attempting something it may not do. */
	static UnauthorizedClientError = UnauthorizedClientError;
	/** A `grant_type` this server does not implement. */
	static UnsupportedGrantTypeError = UnsupportedGrantTypeError;
	/** A `response_type` this server does not implement. */
	static UnsupportedResponseTypeError = UnsupportedResponseTypeError;
	/** Authentication was refused, typically wrong credentials. */
	static AccessDeniedError = AccessDeniedError;
	/** The engine itself failed; the caller did nothing wrong. */
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
	 */
	constructor(
		private issuer: string,
		private repository: OIDC.Repository,
	) {}

	// =========================================================================
	// Token Endpoint
	// =========================================================================

	/**
	 * Runs one of the three supported grants and returns its token response.
	 *
	 * Throws rather than returning a `Result`: every failure here is a protocol error a
	 * controller turns into an OAuth error envelope, and the thrown class carries the
	 * exact `error` code to report.
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
	 * Revokes a refresh token, which means deleting the session it names (RFC 7009).
	 *
	 * An unknown token succeeds silently, as the specification requires, so a client
	 * cannot probe which tokens exist. An access-token hint is accepted and ignored:
	 * access tokens are self-contained and expire on their own.
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
	 *
	 * A token that cannot be resolved is reported inactive rather than raised as an
	 * error, so introspection never becomes an oracle for why a token failed.
	 *
	 * @throws {InvalidClientError} When the client credentials do not check out.
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
				{ issuer: this.issuer, algorithms: [JWK.Algorithm.ES256] },
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

	/**
	 * Resolves a bearer access token to its subject and the scopes it was granted.
	 *
	 * Returns the scopes rather than filtered claims: the caller decides which claims a
	 * scope entitles the client to, since that mapping belongs to the endpoint's response
	 * shape.
	 *
	 * @throws When the token fails signature, issuer or expiry verification.
	 * @throws {InvalidTokenError} When the token was not issued with the `openid` scope.
	 */
	async userinfo(args: { accessToken: string; clientId?: string }) {
		let accessToken = await AccessToken.verify(
			args.accessToken,
			await this.repository.getSigningKey(),
			{ issuer: this.issuer, algorithms: [JWK.Algorithm.ES256] },
		);

		// UserInfo speaks for an end user, which OIDC marks with the `openid` scope. Reading
		// the scopes through the presence-checked accessor keeps a scope-less token from
		// crashing the endpoint; requiring `openid` then refuses one that has no end user to
		// speak for. A `client_credentials` token — whose subject is the client itself and
		// which carries no scope — is exactly that, and must not be answered with a person's
		// claims. The scope is not defaulted to `openid`, since that would readmit it.
		let scope = accessToken.scopes;
		if (!scope.includes("openid")) {
			throw new InvalidTokenError("The access token was not issued with the openid scope");
		}

		let subject = await this.repository.findSubjectById(accessToken.subject);

		return { subject, scope };
	}

	/**
	 * Ends a person's session at this server, from either an `id_token_hint` or the
	 * signed-in session's subject.
	 *
	 * Deletes every session the subject holds — logout here is global, not per client —
	 * and honors `post_logout_redirect_uri` only when a registered client nominated
	 * exactly that address, so the browser can never be sent somewhere unregistered.
	 * An address that cannot be shown to be registered is dropped, not refused: the
	 * returned `redirectUri` is then absent and the sign-out has still happened.
	 *
	 * The relying parties to notify are collected **before** the sessions are deleted
	 * and returned alongside the result. They are derived from those very session rows,
	 * so reading them afterwards would find nothing and the logout fan-out would
	 * silently reach nobody.
	 *
	 * An `id_token_hint` is accepted even once it has expired, per
	 * {@link ID_TOKEN_HINT_CLOCK_TOLERANCE}, and a hint that fails any of the checks that
	 * do apply is refused rather than raised: an unusable hint is a bad request, not a
	 * fault, and it is refused before a single session is deleted.
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
			let signingKeys = await this.repository.getSigningKey();
			let idToken: IdToken;

			try {
				idToken = await IdToken.verify(args.idTokenHint, signingKeys, {
					issuer: this.issuer,
					algorithms: [JWK.Algorithm.ES256],
					clockTolerance: ID_TOKEN_HINT_CLOCK_TOLERANCE,
				});
			} catch {
				// Every way a hint can be unusable — unparseable, signed by somebody else,
				// naming another issuer — is the request's mistake and is answered as one.
				// The reason is not carried out: it would describe a token, and a token is
				// not something this server writes down. Nothing has been deleted yet.
				throw new InvalidRequestError("Invalid id_token_hint");
			}

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

		// A redirect target is honored only when some registered client nominated exactly
		// that address as its logout URI. Being registered is a property of the address
		// itself, so when nothing identified a client the same question is answered by
		// looking the address up among the registrations. The comparison stays an exact
		// equality either way: that is what stops anybody handing a signed-in browser a
		// logout link that lands on their own page wearing this server's flow.
		let redirectUri: string | undefined;

		if (args.postLogoutRedirectUri) {
			let registrant =
				client?.logoutUri === args.postLogoutRedirectUri
					? client
					: await this.repository.findClientByLogoutUri(args.postLogoutRedirectUri);

			// An address nobody registered is dropped rather than refused. Ending the
			// session is what was asked for and only the redirect is unsafe, so the logout
			// goes ahead and the caller is left on a page this server controls.
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

	// =========================================================================
	// Login Methods
	// =========================================================================

	/**
	 * Opens a session, records consent, and issues a single-use authorization code for
	 * the relying party to redeem.
	 *
	 * Returns a `Result` rather than throwing because its callers are browser redirects:
	 * a failure has to become an `error=` parameter on the client's redirect URI, not an
	 * exception page.
	 *
	 * @param input - The subject, client, and authorization request being answered.
	 */
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
	 * An unknown email registers the subject, stores the password as a verified
	 * credential and issues a code, so signing up ends signed in: nothing else in this
	 * server can ever set `verified_at`, and a credential stored `null` is refused
	 * forever. Verification here means "this password belongs to whoever holds this
	 * account", which for an address nobody had registered is whoever chose it; the
	 * address itself stays unverified in `subjects.email_verified_at`.
	 *
	 * A known address with no credential is the one case that still stores the hash
	 * unverified and fails with `MissingValidationError`: the account belongs to
	 * somebody who signs in another way, and a stranger who knows their address must
	 * not be able to attach a working password to it. A correct password against a hash
	 * written under an older scheme is upgraded in place before the code is issued.
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

			// Verified at creation: the person chose this password for an address nobody
			// had registered, so there is no other owner to protect it from, and this
			// server has no channel with which to ask them to confirm anything later.
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

	// =========================================================================
	// Logout Notification Methods
	// =========================================================================

	/**
	 * Notifies every relying party with a back-channel logout URI that a subject signed
	 * out, excluding the client that initiated the logout.
	 *
	 * Delivery is best effort and settled in parallel: one unreachable relying party must
	 * not hold up or fail the logout the person asked for.
	 */
	async sendBackchannelLogoutTokens(subjectId: string, excludeClientId?: string): Promise<void> {
		let sessions = await this.repository.findSessionsForBackchannelLogout(
			subjectId,
			excludeClientId,
		);

		await this.deliverBackchannelLogoutTokens(subjectId, sessions);
	}

	/**
	 * Delivers back-channel logout tokens to an already-collected set of sessions.
	 *
	 * Separate from {@link sendBackchannelLogoutTokens} because the RP-initiated flow has
	 * to read the sessions before it deletes them: once they are gone there is nothing
	 * left to derive the recipient list from.
	 *
	 * Delivery is best effort and settled in parallel: one unreachable relying party must
	 * not hold up or fail the logout the person asked for.
	 *
	 * @param sessions - Sessions to notify, already filtered to exclude the initiating client.
	 */
	async deliverBackchannelLogoutTokens(
		subjectId: string,
		sessions: OIDC.SessionWithClient[],
	): Promise<void> {
		let clientsToNotify = sessions.filter((s) => s.backchannelLogoutUri);

		if (clientsToNotify.length === 0) {
			return;
		}

		// Reading the keys is outside the per-recipient work that `allSettled` contains, so
		// it is the one step whose failure would otherwise reach the caller — and by the
		// time this runs the sessions are already gone, which makes the sign-out a fact
		// rather than something an unreachable key store may still take back.
		try {
			let signingKeys = await this.repository.getSigningKey();

			await Promise.allSettled(
				clientsToNotify.map(async (client) => {
					let sessionId =
						client.backchannelLogoutSessionRequired === "true" ? client.sessionId : undefined;

					let logoutToken = LogoutToken.generate(subjectId, client.clientId, sessionId);
					let signedToken = await logoutToken.sign(JWK.Algorithm.ES256, signingKeys);

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
		} catch {
			// Swallowed for the same reason the settled results are: this is a notification,
			// and no relying party's problem may become the person's.
		}
	}

	/**
	 * Builds the front-channel logout URLs to load in hidden iframes, one per relying
	 * party that registered one, excluding the initiating client.
	 *
	 * `sid` is added only for clients that asked for session-specific logout, so no other
	 * client learns a session id.
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
	 * Turns already-collected sessions into the iframe URLs the browser loads.
	 *
	 * Pure: it issues no query, which is what lets the RP-initiated flow build the list
	 * from sessions it read before deleting them.
	 *
	 * @param sessions - Sessions to notify, already filtered to exclude the initiating client.
	 */
	private buildFrontchannelLogoutUrls(
		sessions: OIDC.SessionWithClient[],
	): OIDC.FrontchannelLogoutUrl[] {
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

		// Stamp the baseline `openid` scope so the refreshed token is one /userinfo will
		// serve — it answers only tokens that carry `openid`. This matches the id_token this
		// grant issues below, which is itself `openid`-scoped by default. A session does not
		// persist the wider scope its original grant may have held, so email/profile are not
		// re-derived here; the token stays as narrow as the id_token it is paired with.
		let accessToken = await this.signJWT(
			AccessToken.generate(session.clientId, session.subjectId, ["openid"]),
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
		return await jwt.sign(JWK.Algorithm.ES256, await this.repository.getSigningKey());
	}

	/**
	 * Replaces a stored hash that is behind current policy, right after the only
	 * moment the plaintext exists: a successful sign-in.
	 *
	 * A hash cannot be strengthened without the password, so a sign-in is the one
	 * chance to rewrite one written under a weaker cost. The upgrade is best
	 * effort — a failed re-hash or a failed write leaves the old hash in place and
	 * the next sign-in tries again, because refusing a correct password would be
	 * far worse than a late upgrade.
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
