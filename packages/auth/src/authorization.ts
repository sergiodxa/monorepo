/**
 * The per-route authorization decisions an app states at its call site: who is
 * here, and what that identity may do. Every answer is read out of band from the
 * request context, so a route or a view asks its question in one word.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { Location } from "@sdxc/location";
import { isFailure, wrap } from "@sdxc/result";
import { getContext } from "remix/middleware/async-context";
import { redirect } from "remix/response/redirect";

import type { AccessToken } from "./access-token";
import type { IdToken } from "./id-token";

import { AuthSession } from "./auth-session";

/** Where a signed-in visitor lands when an app names no destination of its own. */
const DEFAULT_SIGNED_IN = "/";

/** The search parameter a login route reads its post-login destination back from. */
const DEFAULT_RETURN_TO_PARAM = "returnTo";

/**
 * The token set behind the current request, or `null` for a request nobody signed
 * in on.
 *
 * @throws When `asyncContext()` or the session middleware is missing from the
 *   router, since every helper here reads the request through them.
 */
function readAuthSession(): AuthSession | null {
	return AuthSession.from(getContext());
}

/**
 * Answers `null` where reading a claim throws, which is what lets a capability helper
 * promise a boolean to a view that is mid-render.
 *
 * @param result - The attempted claim read.
 * @template value - What the claim reads as.
 */
function claim<value>(result: Result<value, Error>): value | null {
	return isFailure(result) ? null : result.data;
}

/** The current request's ID token, and `null` where no claim can be read from it. */
function readIdToken(): IdToken | null {
	let auth = readAuthSession();
	if (auth === null) return null;
	return claim(wrap(() => auth.idToken));
}

/** The current request's access token, and `null` where no claim reads from it. */
function readAccessToken(): AccessToken | null {
	let auth = readAuthSession();
	if (auth === null) return null;
	return claim(wrap(() => auth.accessToken));
}

/**
 * Binds the routes and the MFA policy every decision is measured against, and
 * answers with the helpers an app re-exports as its own authorization vocabulary.
 *
 * @param options - The login route, where a signed-in visitor belongs, and the
 *   relying party holding the `amr`/`acr` values that count as several factors.
 * @returns The identity helpers, which throw, and the capability helpers, which
 *   answer a boolean for every request.
 * @example
 * export const { currentSession, scope } = createAuthorization({
 * 	login: routes.auth.login.href(),
 * 	relyingParty: () => rp,
 * });
 */
export function createAuthorization(options: Authorization.Options): Authorization.Helpers {
	let login = Location.from(options.login);
	let signedIn = Location.from(options.signedIn ?? DEFAULT_SIGNED_IN);
	let returnToParam = options.returnToParam ?? DEFAULT_RETURN_TO_PARAM;

	/**
	 * The login target for a request, carrying where to come back to.
	 *
	 * The destination comes from the request's own URL through `Location.safe`, so
	 * a path that resolves to another origin comes back to `signedIn` instead.
	 *
	 * @param url - The URL of the request being sent to log in.
	 */
	function loginFor(url: URL): Location {
		let target = new Location(login);
		let returnTo = Location.safe(url, { origin: url.origin, fallback: signedIn });
		target.searchParams.set(returnToParam, returnTo.toString());
		return target;
	}

	return {
		currentSession() {
			let ctx = getContext();
			let auth = AuthSession.from(ctx);
			if (auth !== null) return auth;
			throw redirect(loginFor(ctx.url).toString());
		},

		anonymous() {
			if (readAuthSession() === null) return;
			throw redirect(signedIn.toString());
		},

		subject() {
			let idToken = readIdToken();
			if (idToken === null) return null;
			return claim(wrap(() => idToken.subject));
		},

		scope(name) {
			let accessToken = readAccessToken();
			if (accessToken === null) return false;
			return claim(wrap(() => accessToken.has(name))) ?? false;
		},

		authenticated(duration) {
			let idToken = readIdToken();
			if (idToken === null) return false;
			if (duration === undefined) return true;

			let authTime = claim(wrap(() => idToken.authTime));
			if (authTime === null) return false;

			return Date.now() - authTime.getTime() <= toMs(duration);
		},

		mfa() {
			let idToken = readIdToken();
			if (idToken === null) return false;

			let policy = options.relyingParty();
			return claim(wrap(() => policy.mfa(idToken))) ?? false;
		},
	};
}

export namespace Authorization {
	/** The routes and the policy an app's helpers decide against. */
	export interface Options {
		/**
		 * Where a signed-out request is sent, with the path it came from appended as
		 * a search parameter for the login flow to return it to.
		 */
		login: string | URL | Location;

		/**
		 * Where a request that is already signed in is sent from a page meant for
		 * anonymous visitors, and where a login returns to when the path it came
		 * from is unusable.
		 *
		 * @default "/"
		 */
		signedIn?: string | URL | Location;

		/**
		 * The search parameter carrying the post-login destination, matching the name
		 * the app's own login route reads.
		 *
		 * @default "returnTo"
		 */
		returnToParam?: string;

		/**
		 * The holder of the `amr`/`acr` values that count as several factors, read on
		 * every `mfa()` call, so an app may answer with an instance it builds per
		 * request.
		 */
		relyingParty: () => MfaPolicy;
	}

	/** Which reported authentication methods an app counts as several factors. */
	export interface MfaPolicy {
		/**
		 * Whether the provider reported that more than one factor took part.
		 *
		 * @param idToken - The ID token the login produced.
		 */
		mfa(idToken: IdToken): boolean;
	}

	/**
	 * The two families an app re-exports: identity, which answers "nobody is here"
	 * with a redirect, and capability, which answers every request with a boolean.
	 */
	export interface Helpers {
		/**
		 * The session behind the current request.
		 *
		 * @returns The token set a completed login left behind.
		 * @throws {Response} A redirect to the login route, carrying where to come
		 *   back to, for a request nobody has signed in on. It reaches the browser
		 *   through `@sdxc/catch-response-middleware`.
		 * @example
		 * let session = currentSession();
		 */
		currentSession: () => AuthSession;

		/**
		 * Guards a page meant for visitors nobody has signed in on — a login form, a
		 * password reset — by sending anyone already signed in to `signedIn`.
		 *
		 * @throws {Response} A redirect to `signedIn` for a signed-in request.
		 * @example
		 * anonymous();
		 */
		anonymous: () => void;

		/**
		 * The identity anchor an app keys its own records on.
		 *
		 * @returns The `sub` claim, and `null` for a request nobody signed in on, so
		 *   it is safe to read while a view renders.
		 * @example
		 * let user = subject() ? await users.getBySubject(subject()) : null;
		 */
		subject: () => string | null;

		/**
		 * Whether the client was granted a scope on the person's behalf, which is
		 * delegation and passes alongside the app's own permission check.
		 *
		 * @param name - The scope to look for.
		 * @returns `false` for a request nobody signed in on, so a view may branch on
		 *   it directly.
		 * @example
		 * {scope("monitors:write") ? <DeleteForm /> : null}
		 */
		scope: (name: string) => boolean;

		/**
		 * Whether anyone is here and authenticated within the given window, measured
		 * from `auth_time`, which survives every token refresh, so a long-lived session
		 * can read as authenticated while a step-up window has run out.
		 *
		 * @param duration - How recent the authentication must be, as a duration
		 *   string or milliseconds. Called with none, it answers whether anyone is
		 *   signed in at all.
		 * @returns `false` for a request nobody signed in on, and `false` when a
		 *   window is asked for and the provider reported no `auth_time`.
		 * @example
		 * if (!authenticated("5m")) throw redirect(routes.auth.confirmPassword.href());
		 */
		authenticated: (duration?: DurationInput) => boolean;

		/**
		 * Whether the provider reported that more than one factor took part in the
		 * login behind this request.
		 *
		 * @returns `false` for a request nobody signed in on, and `false` for a
		 *   provider that reports neither `amr` nor `acr`.
		 * @example
		 * if (!mfa()) throw redirect(routes.auth.confirmMfa.href());
		 */
		mfa: () => boolean;
	}
}
