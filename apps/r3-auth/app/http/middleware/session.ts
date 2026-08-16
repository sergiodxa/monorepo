/**
 * The identity provider's own browser session: a signed, httpOnly cookie naming a
 * record in KV that holds the tokens this server issued to itself and the
 * authorization request currently in flight. Also the typed accessors every handler
 * reads and writes that state through, so the key names live in one module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KVSessionStorage } from "@pkg/session-storage-kv";
import { createCookie } from "remix/cookie";
import { getContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { Session } from "remix/session";

/**
 * Name of the signed cookie carrying the session id.
 *
 * Deliberately not the name the React app used: the stored record has a different
 * format, and a distinct name means rolling back finds its own untouched cookie
 * rather than one it cannot parse.
 */
const SESSION_COOKIE_NAME = "auth:session";

/** Session lifetime in seconds (30 days), matching the KV entry TTL and the cookie's `maxAge`. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Key prefix session records are stored under in KV. */
const SESSION_PREFIX = "session:";

/** Keys the session record holds. Read and written only through the accessors below. */
enum SESSION_KEYS {
	ACCESS_TOKEN = "accessToken",
	REFRESH_TOKEN = "refreshToken",
	AUTHZ = "authz",
}

/** Response modes an authorization request may ask its answer to be delivered in. */
export type ResponseMode = "query" | "fragment" | "form_post";

/** The `prompt` values this server understands (OIDC Core plus Prompt Create 1.0). */
export type PromptValue = "none" | "login" | "consent" | "select_account" | "create";

/**
 * The authorization request a sign-in is being performed for, parked in the session
 * between the `/authorize` redirect and whichever login flow completes it.
 *
 * `codeChallenge` / `codeChallengeMethod` are carried here so PKCE survives the
 * round trip through the login UI: they arrive on the `/authorize` request and are
 * needed when the code is finally issued, which happens on a later request.
 */
export interface AuthzState {
	clientId: string;
	state: string;
	redirectUri: string;
	nonce?: string;
	scope?: string[];
	responseMode?: ResponseMode;
	prompt?: PromptValue[];
	codeChallenge?: string;
	codeChallengeMethod?: "S256" | "plain";
}

/**
 * Creates the session middleware, signing its cookie with the given secret and
 * persisting session data in KV under `session:` keys.
 *
 * @param kv - KV namespace backing session storage.
 * @param cookieSecret - Secret the session cookie is signed with.
 * @param secure - Whether the cookie should be marked `Secure`.
 * @param domain - Cookie domain, so one session covers every subdomain in production.
 */
export function createSessionMiddleware(
	kv: KVNamespace,
	cookieSecret: string,
	secure: boolean,
	domain?: string,
) {
	let cookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure,
		domain,
		secrets: [cookieSecret],
	});

	let storage = new KVSessionStorage(kv, {
		ttlSeconds: SESSION_TTL_SECONDS,
		prefix: SESSION_PREFIX,
	});

	return session(cookie, storage);
}

/**
 * The current request's session.
 *
 * @throws When the session middleware did not run for this request.
 */
function readSession(): Session {
	let value = getContext().get(Session);
	if (!value) throw new Error("No session in context: the session middleware did not run.");
	return value;
}

/**
 * The access token this server issued to itself for the signed-in person, or `null`
 * when nobody is signed in to the identity provider itself.
 */
export function getAccessToken(): string | null {
	let value = readSession().get(SESSION_KEYS.ACCESS_TOKEN);
	return typeof value === "string" ? value : null;
}

/** The refresh token paired with {@link getAccessToken}, or `null` when there is none. */
export function getRefreshToken(): string | null {
	let value = readSession().get(SESSION_KEYS.REFRESH_TOKEN);
	return typeof value === "string" ? value : null;
}

/**
 * Stores both tokens for the signed-in person. Always written as a pair: a session
 * holding one without the other cannot refresh and cannot be recovered from.
 */
export function setTokens(accessToken: string, refreshToken: string): void {
	let value = readSession();
	value.set(SESSION_KEYS.ACCESS_TOKEN, accessToken);
	value.set(SESSION_KEYS.REFRESH_TOKEN, refreshToken);
}

/** Drops both tokens, which signs the person out of the identity provider itself. */
export function unsetTokens(): void {
	let value = readSession();
	value.unset(SESSION_KEYS.ACCESS_TOKEN);
	value.unset(SESSION_KEYS.REFRESH_TOKEN);
}

/**
 * Discards the whole session record, not just its contents: the KV entry is deleted
 * and the response replaces the cookie with an empty one.
 *
 * Nothing may read or write the session afterwards — a destroyed session throws on
 * access — so call this last, once the response is decided.
 */
export function destroySession(): void {
	readSession().destroy();
}

/**
 * The authorization request currently in flight, or `null` when none is parked.
 *
 * The stored value is validated structurally rather than trusted: a record written by
 * an older deployment, or by a session whose format has since changed, must read as
 * "no request in flight" instead of feeding half a request into the code issuer.
 */
export function getAuthz(): AuthzState | null {
	let value: unknown = readSession().get(SESSION_KEYS.AUTHZ);
	if (typeof value !== "object" || value === null) return null;

	let candidate = value as Partial<AuthzState>;
	if (typeof candidate.clientId !== "string") return null;
	if (typeof candidate.state !== "string") return null;
	if (typeof candidate.redirectUri !== "string") return null;

	return candidate as AuthzState;
}

/** Parks an authorization request for the login flow that is about to run. */
export function setAuthz(authz: AuthzState): void {
	readSession().set(SESSION_KEYS.AUTHZ, authz);
}

/** Clears the parked authorization request once it has been answered. */
export function unsetAuthz(): void {
	readSession().unset(SESSION_KEYS.AUTHZ);
}
