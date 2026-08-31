/**
 * The role an app plays when someone else calls it. It turns the access token a caller
 * presents into the claims behind it, and answers either as a `remix/middleware/auth`
 * scheme a route reads through `getContext().get(Auth)`, or as a direct call for an app
 * holding a token and no request to read it from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthScheme, AuthSchemeFailure } from "remix/middleware/auth";
import type { RequestContext } from "remix/router";

import { isFailure, wrap } from "@pkg/result";

import type { Issuer } from "./issuer";

import { AccessToken } from "./access-token";
import { AuthError, AuthErrorCode } from "./auth-error";

/** Milliseconds in a second, for the epoch claim an introspected token is given. */
const MS_PER_SECOND = 1000;

/** The authentication scheme name RFC 6750 §2.1 gives bearer credentials. */
const BEARER = "bearer";

/** The method name the resolved auth state reports for a bearer credential. */
const DEFAULT_SCHEME_NAME = "bearer";

/** Splits an `Authorization` header into its scheme and the credential after it. */
const AUTHORIZATION_HEADER = /^(\S+)[ \t]+(\S.*)$/;

/** Matches the three base64url segments of an RFC 7515 §3.1 compact serialization. */
const COMPACT_JWS = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * The answer a presented credential this server does not accept is reported with. The
 * challenge is the one RFC 6750 §3 pairs with a rejected token, and the middleware
 * forwards it as `WWW-Authenticate` so a client knows to obtain a new one.
 */
const REJECTED: AuthSchemeFailure = {
	status: "failure",
	code: "invalid_credentials",
	message: "The bearer token was not accepted.",
	challenge: `Bearer error="invalid_token"`,
};

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
 * An API this app exposes to callers holding an access token.
 *
 * A token signed by the issuer is verified against the key set the issuer publishes; a
 * token carrying no claims of its own is described by the issuer over RFC 7662
 * introspection.
 *
 * Both paths end at the same `AccessToken`, and both hold the token to one of this
 * server's audiences, so the audiences configured here are the whole of what a caller
 * reaches whichever path answered.
 *
 * @example
 * let api = new ResourceServer(issuer, { audience: clientId, introspection: service });
 * auth({ schemes: [api.scheme({ verify: (token) => ({ clientId: token.clientId }) })] });
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
	 * A `remix/middleware/auth` scheme that resolves the request's bearer token into
	 * the identity the app's `verify` returns.
	 *
	 * A request carrying no bearer credential is left to the next scheme and to a
	 * public route, which is the middleware's ordinary path. A presented credential
	 * this server does not accept is reported as a failure carrying RFC 6750's
	 * challenge, so the request stops here with a `401` naming the reason.
	 *
	 * An issuer that cannot serve its own documents surfaces as the `AuthError` it is,
	 * keeping an outage a fault the app handles rather than a caller holding a bad token.
	 *
	 * @param options - The app's `verify`, and the method name to report.
	 * @returns A scheme for `auth({ schemes: [...] })`.
	 * @example
	 * api.scheme({ verify: (token) => users.getBySubject(token.subject) });
	 * @example
	 * api.scheme({ verify: (token) => (token.subject === token.clientId ? service : null) });
	 */
	scheme<identity>(options: ResourceServer.SchemeOptions<identity>): AuthScheme<identity> {
		return {
			name: options.name ?? DEFAULT_SCHEME_NAME,

			/**
			 * Resolves the request's credential and asks the app who is holding it.
			 *
			 * @param context - The request being authenticated.
			 * @returns The identity, the rejection, or nothing at all for a request
			 *   carrying no bearer credential.
			 */
			authenticate: async (context: RequestContext) => {
				let credential = readBearerCredential(context.headers.get("authorization"));
				if (credential === null) return null;

				let token = await wrap(() => this.verifyAccessToken(credential));

				if (isFailure(token)) {
					if (AuthError.is(token.error, AuthErrorCode.InvalidToken)) return REJECTED;
					throw token.error;
				}

				let identity = await options.verify(token.data, context);
				if (identity === null) return REJECTED;

				return { status: "success", identity };
			},
		};
	}

	/**
	 * Verifies an access token an app obtained outside a request — a queued job whose
	 * payload carries one, a connection authenticated once at its upgrade, a token that
	 * arrived somewhere other than an `Authorization` header, a fixture.
	 *
	 * Accepts whichever form the issuer hands out, and runs every check the scheme runs,
	 * answering with the reason a credential was declined so a caller with no scheme
	 * chain behind it can act on it.
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
	 * @returns The token, or `null` when this server does not accept the credential.
	 */
	async #resolve(credential: string): Promise<AccessToken | null> {
		if (COMPACT_JWS.test(credential)) return await this.#verify(credential);
		return await this.#introspect(credential);
	}

	/**
	 * Verifies a JWT access token: its signature against the key the issuer publishes
	 * for the `kid` it names, then its `iss`, its `aud`, and its lifetime.
	 *
	 * Reading the key set before the verification keeps an issuer that cannot publish
	 * one reported as the `AuthError` it is, and keeps a rejected token reported as a
	 * credential this server declines.
	 *
	 * @param credential - The compact-serialized token.
	 * @returns The verified token, or `null` when a check on it fails.
	 * @throws `DiscoveryFailed` or `JwksFailed` when the issuer's documents are unreadable.
	 */
	async #verify(credential: string): Promise<AccessToken | null> {
		let [keys, issuer] = await Promise.all([this.#issuer.keys(), this.#issuer.identifier()]);

		try {
			return await AccessToken.verify(credential, keys, { issuer, audience: this.#audience });
		} catch {
			return null;
		}
	}

	/**
	 * Asks the issuer to describe a credential, and rebuilds the answer as an
	 * `AccessToken` so both paths hand the app the same claims.
	 *
	 * A description is accepted when it names one of this server's audiences, holding
	 * the introspection path to what the local path checks in `aud`.
	 *
	 * RFC 7662 §2.2 leaves `aud` optional, so a description naming none is accepted
	 * where `acceptUnscopedIntrospection` puts the issuer's own scoping in its place.
	 *
	 * A description naming its issuer is accepted when that issuer is this one, and a
	 * server configured with no introspector accepts JWT access tokens.
	 *
	 * @param credential - The credential as presented.
	 * @returns The token the issuer described, or `null` when it stands behind none.
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
		 * The audiences this server answers for. A token is accepted when its `aud`,
		 * written by the provider as one value or as a list, carries any of them.
		 *
		 * An authorization-code token names the client id it was issued to, and a
		 * client-credentials token names the issuer alongside the resources it asked
		 * for, so a server reachable by both is configured with both.
		 */
		audience: string | string[];

		/**
		 * Who asks the issuer about a credential carrying no claims of its own.
		 * Supplying one opens the introspection path.
		 */
		introspection?: Introspector;

		/**
		 * Whether a token the issuer describes without naming any audience is accepted
		 * on the issuer's scoping alone.
		 *
		 * Left off, such a description is refused, so every accepted credential has
		 * named this server. Turn it on for an issuer whose introspection endpoint
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

	/** How the scheme a {@link ResourceServer.scheme} builds is configured. */
	export interface SchemeOptions<identity> {
		/**
		 * Turns a token this server accepted into the identity a route reads, answering
		 * `null` for a caller the app itself declines.
		 *
		 * @param token - The verified or introspected access token.
		 * @param context - The request being authenticated.
		 */
		verify(token: AccessToken, context: RequestContext): identity | null | Promise<identity | null>;

		/**
		 * The method name the resolved auth state reports, which tells apart two
		 * resource servers in one app.
		 *
		 * @default "bearer"
		 */
		name?: string;
	}
}
