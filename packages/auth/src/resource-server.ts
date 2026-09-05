/**
 * The role an app plays when someone else calls it: it turns the access token a caller
 * presents into the claims behind it, read off the request's `Authorization` header or
 * handed over as the bare credential an app holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Issuer } from "./issuer.js";

import { AccessToken } from "./access-token.js";
import { AuthError, AuthErrorCode } from "./auth-error.js";

/** Milliseconds in a second, for the epoch claim an introspected token is given. */
const MS_PER_SECOND = 1000;

/** The authentication scheme name RFC 6750 §2.1 gives bearer credentials. */
const BEARER = "bearer";

/** Splits an `Authorization` header into its scheme and the credential after it. */
const AUTHORIZATION_HEADER = /^(\S+)[ \t]+(\S.*)$/;

/** Matches the three base64url segments of an RFC 7515 §3.1 compact serialization. */
const COMPACT_JWS = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * Reports whether a token's audiences include one this server answers for. Each side
 * reads as a list, so one value and several are matched the same way.
 *
 * @param audiences - The audiences the token names.
 * @param accepted - The audiences the server was configured for.
 */
function shares(audiences: string[], accepted: string | string[]): boolean {
	let expected = Array.isArray(accepted) ? accepted : [accepted];
	return audiences.some((audience) => expected.includes(audience));
}

/**
 * Reads the credential out of an `Authorization` header, per RFC 6750 §2.1.
 *
 * @param header - The header value, absent as `null`.
 * @returns The credential, or `null` when the header carries one for a different
 *   authentication scheme, which is another scheme's to answer.
 */
function readBearerCredential(header: string | null): string | null {
	if (header === null) return null;

	let match = AUTHORIZATION_HEADER.exec(header);
	if (match === null) return null;

	let [, scheme, credential] = match;
	if (scheme === undefined || credential === undefined) return null;
	if (scheme.toLowerCase() !== BEARER) return null;

	return credential.trim();
}

/**
 * An API this app exposes to callers holding an access token. A signed token is verified
 * against the key set the issuer publishes and a claimless one is described over RFC 7662
 * introspection; both paths end at an `AccessToken` held to one of this server's audiences.
 *
 * @example
 * let api = new ResourceServer(issuer, { audience: clientId, introspection: service });
 * let token = await api.verifyRequest(request);
 * @example
 * let token = await api.verifyAccessToken(envelope.accessToken);
 */
export class ResourceServer {
	#issuer: Issuer;
	#audience: string | string[];
	#introspection: ResourceServer.Introspector | null;
	#acceptUnscopedIntrospection: boolean;

	/**
	 * Points a resource server at the issuer whose tokens it accepts.
	 *
	 * @param issuer - The issuer publishing the keys and describing opaque tokens.
	 * @param options - The audiences this server answers for, and the introspector.
	 */
	constructor(issuer: Issuer, options: ResourceServer.Options) {
		this.#issuer = issuer;
		this.#audience = options.audience;
		this.#introspection = options.introspection ?? null;
		this.#acceptUnscopedIntrospection = options.acceptUnscopedIntrospection ?? false;
	}

	/**
	 * The provider whose tokens this server accepts, so a collaborator verifying a
	 * token of its own works against the same one.
	 */
	get issuer(): Issuer {
		return this.#issuer;
	}

	/**
	 * Resolves the bearer credential a request carries, per RFC 6750 §2.1, into the token
	 * behind it. A request carrying no bearer credential is another authentication
	 * method's to answer, so it is told apart from a credential this server declines.
	 *
	 * @param request - The request being authenticated.
	 * @returns The token this server accepted, or `null` for a request carrying no
	 *   bearer credential.
	 * @throws {AuthError} `invalid_token` when this server declines the credential, and
	 *   `discovery_failed` or `jwks_failed` when the issuer's documents are unreadable.
	 * @example
	 * let token = await api.verifyRequest(request);
	 * if (token === null) return next();
	 */
	async verifyRequest(request: Request): Promise<AccessToken | null> {
		let credential = readBearerCredential(request.headers.get("authorization"));
		if (credential === null) return null;
		return await this.verifyAccessToken(credential);
	}

	/**
	 * Verifies an access token an app obtained outside a request — a queued job whose
	 * payload carries one, a connection authenticated once at its upgrade, a fixture. It
	 * accepts whichever form the issuer hands out and runs every check `verifyRequest` runs.
	 *
	 * @param credential - The access token as presented.
	 * @returns The token this server accepted.
	 * @throws {AuthError} `invalid_token` when this server declines the credential, and
	 *   `discovery_failed` or `jwks_failed` when the issuer's documents are unreadable.
	 * @example
	 * let token = await api.verifyAccessToken(job.payload.accessToken);
	 */
	async verifyAccessToken(credential: string): Promise<AccessToken> {
		let token = await this.#resolve(credential);

		if (token === null) {
			throw new AuthError("The access token was not accepted.", {
				code: AuthErrorCode.InvalidToken,
			});
		}

		return token;
	}

	/**
	 * Turns a credential into the token it stands for. A JWT is verified locally against
	 * the issuer's key set, and a credential carrying no claims is described by the
	 * issuer itself.
	 *
	 * @param credential - The credential as presented.
	 * @returns The token, or `null` when this server declines the credential.
	 */
	async #resolve(credential: string): Promise<AccessToken | null> {
		if (COMPACT_JWS.test(credential)) return await this.#verify(credential);
		return await this.#introspect(credential);
	}

	/**
	 * Verifies a JWT access token against the key set the issuer publishes. An issuer
	 * outage surfaces as an `AuthError`, whether it met the read of the set or a refetch
	 * within the verification, and `null` answers only a token that failed a check here.
	 *
	 * @param credential - The compact-serialized token.
	 * @returns The verified token, or `null` when a check on it fails.
	 * @throws `DiscoveryFailed` or `JwksFailed` when the issuer's documents are unreadable.
	 */
	async #verify(credential: string): Promise<AccessToken | null> {
		let [keys, issuer] = await Promise.all([this.#issuer.keys(), this.#issuer.identifier()]);

		try {
			return await AccessToken.verify(credential, keys, { issuer, audience: this.#audience });
		} catch (error) {
			if (AuthError.is(error, AuthErrorCode.JwksFailed)) throw error;
			return null;
		}
	}

	/**
	 * Asks the issuer to describe a credential, and rebuilds the answer as an `AccessToken`
	 * so both paths hand the app the same claims. A description is accepted when it names
	 * one of this server's audiences and names this server's issuer.
	 *
	 * @param credential - The credential as presented.
	 * @returns The token the issuer described, `null` when the issuer stands behind none,
	 *   and `null` for a server configured with no introspector.
	 */
	async #introspect(credential: string): Promise<AccessToken | null> {
		if (this.#introspection === null) return null;

		let description = await this.#introspection.introspect(credential);
		if (!description.active) return null;

		if (description.audience.length === 0) {
			if (!this.#acceptUnscopedIntrospection) return null;
		} else if (!shares(description.audience, this.#audience)) {
			return null;
		}

		if (description.issuer !== null && description.issuer !== (await this.#issuer.identifier())) {
			return null;
		}

		return new AccessToken({
			iss: description.issuer ?? undefined,
			sub: description.subject ?? undefined,
			aud: description.audience,
			client_id: description.clientId ?? undefined,
			scope: description.scopes.join(" "),
			exp:
				description.expiresAt === null
					? undefined
					: Math.floor(description.expiresAt.getTime() / MS_PER_SECOND),
		});
	}
}

export namespace ResourceServer {
	/** How a {@link ResourceServer} is configured. */
	export interface Options {
		/**
		 * The audiences this server answers for; a token is accepted when its `aud`, written
		 * as one value or as a list, carries any of them. An authorization-code token names
		 * the client id, a client-credentials token the issuer and the resources it asked for.
		 */
		audience: string | string[];

		/**
		 * Who asks the issuer about a credential carrying no claims of its own.
		 * Supplying one opens the introspection path.
		 */
		introspection?: Introspector;

		/**
		 * Whether a token the issuer describes without naming any audience is accepted on
		 * the issuer's scoping alone. Turn it on for an issuer whose introspection endpoint
		 * answers only for tokens this server may honor.
		 *
		 * @default false
		 */
		acceptUnscopedIntrospection?: boolean;
	}

	/**
	 * What the issuer says about a token, in the shape a resource server reads. A
	 * single-valued `aud` arrives as a one-element list, an `aud` the issuer left out
	 * arrives as an empty one, and every other member it left out arrives as `null`.
	 */
	export interface Introspection {
		/** Whether the issuer stands behind the token right now. */
		active: boolean;
		/** Who the token was issued for, a person or the client itself. */
		subject: string | null;
		/** The client the token was issued to. */
		clientId: string | null;
		/** The scopes the token was granted. */
		scopes: string[];
		/** Who the token is meant for. */
		audience: string[];
		/** Who issued the token. */
		issuer: string | null;
		/** When the token stops being honored. */
		expiresAt: Date | null;
	}

	/** The RFC 7662 call a credential carrying no claims is resolved through. */
	export interface Introspector {
		/**
		 * Asks the issuer to describe a token, authenticating to it as the client.
		 *
		 * @param token - The credential as presented.
		 * @returns What the issuer says about it.
		 */
		introspect(token: string): Promise<Introspection>;
	}
}
