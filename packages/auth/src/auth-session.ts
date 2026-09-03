/**
 * The token set a completed login leaves behind, and the reads an app makes of
 * it. It is the whole of what this package persists, so a signed-in request is
 * one session key plus the claims that were verified when the key was written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { Session } from "remix/session";

import { AccessToken } from "./access-token.js";
import { AuthError, AuthErrorCode } from "./auth-error.js";
import { accessTokenExpiry, signedExpiry, spent } from "./expiry.js";
import { IdToken } from "./id-token.js";

/**
 * The single session key this package writes, so an app reading the session
 * directly knows which entry belongs here and every other entry stays its own.
 */
const SESSION_KEY = "auth";

/**
 * Seconds of remaining lifetime an access token is already treated as spent at,
 * so a token nearing its end is renewed before the request reaches for it.
 */
const EXPIRY_RESERVE_SECONDS = 30;

/**
 * The stored shape, re-validated on every read: the session arrives from a cookie,
 * so a record written by an older version of this package reads as signed out.
 */
const TOKENS_SCHEMA = s.object({
	idToken: s.string(),
	accessToken: s.string(),
	refreshToken: s.nullable(s.string()),
	expiresAt: s.nullable(s.number()),
});

/**
 * Reads the session a request carries.
 *
 * @param ctx - The request context the session middleware wrote to.
 * @returns The request's session.
 * @throws When the session middleware has not run, since every read and write
 *   here goes through it.
 */
function readSession(ctx: AuthSession.Context): Session {
	let session = ctx.get(Session);
	if (!session) {
		throw new Error("@sdxc/auth needs remix/middleware/session installed on the router");
	}
	return session;
}

/**
 * A signed-in request's tokens, read through the classes that name their claims.
 *
 * Reads are lazy and memoized, so a route that only needs the subject pays for
 * one token, and the tokens a route does read stay the same objects throughout it.
 *
 * @example
 * let auth = AuthSession.from(ctx);
 * if (auth?.expired) await auth.refresh(rp);
 */
export class AuthSession {
	#session: Session;
	#tokens: AuthSession.Tokens;
	#idToken: IdToken | null = null;
	#accessToken: AccessToken | null = null;

	private constructor(session: Session, tokens: AuthSession.Tokens) {
		this.#session = session;
		this.#tokens = tokens;
	}

	/**
	 * The ID token, carrying the subject an app keys its own records on and every
	 * claim a step-up decision is answered in.
	 */
	get idToken(): IdToken {
		this.#idToken ??= IdToken.decode(this.#tokens.idToken);
		return this.#idToken;
	}

	/** The access token, carrying the scopes the client was granted. */
	get accessToken(): AccessToken {
		this.#accessToken ??= AccessToken.decode(this.#tokens.accessToken);
		return this.#accessToken;
	}

	/** The refresh token, present when the grant included the `offline_access` scope. */
	get refreshToken(): string | null {
		return this.#tokens.refreshToken;
	}

	/**
	 * The token set as the provider issued it, for the steps that send a token on:
	 * `id_token_hint` on logout, a bearer header on an outbound call.
	 */
	get tokens(): AuthSession.Tokens {
		return { ...this.#tokens };
	}

	/**
	 * Whether the stored token set has reached its end, counting a 30-second reserve so a
	 * token nearing that end is renewed before the request reaches for it. It describes the
	 * tokens rather than the person: a set past its end still names who signed in.
	 *
	 * @returns `true` for a set whose end has arrived, and for one that states no end
	 *   at all, which is a set nothing vouches for.
	 */
	get expired(): boolean {
		return spent(this.#expiresAt(), EXPIRY_RESERVE_SECONDS);
	}

	/**
	 * Whether the stored set carries what `refresh` spends, which is what separates a
	 * session that can be brought back to life from one that never could. A set that is
	 * `expired` and not renewable is as live as it will get, and stays signed in.
	 *
	 * @example if (auth.expired && !auth.renewable) return readClaimsOnly(auth.idToken);
	 */
	get renewable(): boolean {
		return this.#tokens.refreshToken !== null;
	}

	/**
	 * Spends the refresh token on a new access token and rewrites the session, so the
	 * rest of the request reads the renewed set. A response carrying only a new access
	 * token leaves the stored ID and refresh tokens in place.
	 *
	 * @param client - The relying party that holds the credentials for the exchange.
	 * @returns This session, now carrying the renewed tokens.
	 * @throws {AuthError} `missing_refresh_token` when the grant carried none, which reports
	 *   a set that was never renewable rather than a session the provider has ended.
	 * @example
	 * if (auth.expired && auth.renewable) await auth.refresh(rp);
	 */
	async refresh(client: AuthSession.Client): Promise<AuthSession> {
		let refreshToken = this.#tokens.refreshToken;

		if (!refreshToken) {
			throw new AuthError("The session carries no refresh token to extend it with", {
				code: AuthErrorCode.MissingRefreshToken,
			});
		}

		let refreshed = await client.exchangeRefreshToken(refreshToken);

		this.#tokens = {
			idToken: refreshed.idToken ?? this.#tokens.idToken,
			accessToken: refreshed.accessToken,
			refreshToken: refreshed.refreshToken ?? refreshToken,
			expiresAt: refreshed.expiresAt,
		};
		this.#idToken = null;
		this.#accessToken = null;
		this.#session.set(SESSION_KEY, this.#tokens);

		return this;
	}

	/**
	 * When the stored token set stops being good for the request, in seconds since
	 * the epoch, from the most authoritative source the set carries.
	 *
	 * @returns The expiry, and `null` for a set stating none.
	 */
	#expiresAt(): number | null {
		return (
			accessTokenExpiry(this.#tokens.accessToken, this.#tokens.expiresAt) ??
			signedExpiry(this.#tokens.idToken)
		);
	}

	/**
	 * Signs the request out by dropping this package's key, leaving every other
	 * entry in the session — a locale, a flash message — untouched.
	 */
	clear(): void {
		this.#session.unset(SESSION_KEY);
	}

	/**
	 * Reads the token set a login stored.
	 *
	 * @param ctx - The request context the session middleware wrote to.
	 * @returns The session, or `null` for a request that is signed out.
	 * @example
	 * let auth = AuthSession.from(ctx);
	 * if (!auth) throw redirect(href("/login"));
	 */
	static from(ctx: AuthSession.Context): AuthSession | null {
		let session = readSession(ctx);
		let stored = session.get(SESSION_KEY);
		if (stored === undefined) return null;

		let parsed = s.parseSafe(TOKENS_SCHEMA, stored);
		if (!parsed.success) return null;

		return new AuthSession(session, parsed.value);
	}

	/**
	 * Stores a token set as the request's session, which is what makes the request
	 * after it signed in.
	 *
	 * @param ctx - The request context the session middleware wrote to.
	 * @param tokens - The verified token set to persist.
	 * @returns The session the tokens were written to.
	 */
	static write(ctx: AuthSession.Context, tokens: AuthSession.Tokens): AuthSession {
		let session = readSession(ctx);
		session.set(SESSION_KEY, { ...tokens });
		return new AuthSession(session, tokens);
	}
}

export namespace AuthSession {
	/**
	 * The part of a request context this package reads: the request URL a redirect
	 * target is measured against, and the session middleware's entry.
	 */
	export interface Context {
		/** The URL of the current request. */
		readonly url: URL;
		/**
		 * Reads a value the middleware chain stored.
		 *
		 * @param key - The context key to read.
		 */
		get(key: typeof Session): Session | undefined;
	}

	/** A token set as it is stored, in the strings the provider issued. */
	export interface Tokens {
		/** The compact-serialized ID token, verified before it was stored. */
		idToken: string;
		/** The compact-serialized access token. */
		accessToken: string;
		/** The refresh token, when the grant included one. */
		refreshToken: string | null;
		/**
		 * Seconds since the epoch the token endpoint stated the access token lapses
		 * at, and `null` where it stated no lifetime. A signed access token's own
		 * `exp` is what `expired` reads first.
		 */
		expiresAt: number | null;
	}

	/** What a refresh answered with, where an omitted token keeps the stored one. */
	export interface Refreshed {
		/** A reissued ID token, when the provider sent one. */
		idToken: string | null;
		/** The renewed access token. */
		accessToken: string;
		/** A rotated refresh token, when the provider rotates them. */
		refreshToken: string | null;
		/** Seconds since the epoch at which the renewed access token lapses. */
		expiresAt: number | null;
	}

	/** The credential holder a refresh is run through. */
	export interface Client {
		/**
		 * Spends a refresh token at the token endpoint.
		 *
		 * @param refreshToken - The refresh token to present.
		 */
		exchangeRefreshToken(refreshToken: string): Promise<Refreshed>;
	}
}
