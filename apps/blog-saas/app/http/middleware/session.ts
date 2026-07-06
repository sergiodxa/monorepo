/**
 * The dashboard session middleware and its typed accessors: a signed-cookie session
 * holding the authenticated account id and the in-flight OIDC PKCE transaction, with
 * defensive read/write helpers used across the auth flow.
 *
 * The cookie is signed but not encrypted, so it deliberately never holds the raw IdP
 * ID token (whose claims would then be readable by the browser and could push the
 * cookie past size limits). RP-initiated logout identifies the client by its
 * configured `client_id` instead of an `id_token_hint`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/fetch-router";

import { getContext } from "remix/async-context-middleware";
import { createCookie } from "remix/cookie";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

/** OIDC PKCE transaction stored between login start and callback. */
export interface AuthTransaction {
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

/** Signed-cookie session payload for the dashboard. */
export interface SessionData {
	accountId?: string;
	auth?: AuthTransaction;
}

const SESSION_COOKIE = "blog_saas_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Builds the dashboard session middleware backed by Remix's signed-cookie session
 * storage (`remix/session-middleware` + `createCookieSessionStorage`). The cookie is
 * signed with the platform secret, so a tampered payload fails verification and reads
 * back as an empty session.
 *
 * @param secret The signing secret for the session cookie.
 * @param isProd When `true`, marks the cookie `Secure` (HTTPS-only).
 * @returns The configured session middleware.
 */
export function createSessionMiddleware(secret: string, isProd: boolean): Middleware {
	let cookie = createCookie(SESSION_COOKIE, {
		path: "/",
		httpOnly: true,
		sameSite: "Lax",
		secure: isProd,
		maxAge: SESSION_MAX_AGE,
		secrets: [secret],
	});
	return session(cookie, createCookieSessionStorage()) as Middleware;
}

/**
 * Resolves the current request's session from the async context.
 *
 * @returns The active {@link Session}.
 * @throws If the session middleware is not installed on the request.
 */
function current(): Session {
	let ctx = getContext();
	if (!ctx.has(Session)) throw new Error("Session middleware is not installed.");
	return ctx.get(Session) as Session;
}

/**
 * Reads the current session data, validating each field's runtime shape defensively
 * so a malformed cookie cannot inject unexpected values.
 *
 * @returns The validated session data (fields absent when missing or invalid).
 */
export function getSessionData(): SessionData {
	let store = current();
	let data: SessionData = {};
	let accountId = store.get("accountId");
	if (typeof accountId === "string") data.accountId = accountId;
	let auth = store.get("auth");
	if (auth && typeof auth === "object") data.auth = auth as AuthTransaction;
	return data;
}

/**
 * Applies a partial update to the session data. A key present in the patch with an
 * `undefined` value is unset; other keys are written.
 *
 * @param patch The session fields to set or unset.
 * @returns Nothing.
 */
export function updateSessionData(patch: Partial<SessionData>): void {
	let store = current();
	for (let key of ["accountId", "auth"] as const) {
		if (!(key in patch)) continue;
		let value = patch[key];
		if (value === undefined) store.unset(key);
		else store.set(key, value);
	}
}

/**
 * Destroys the current session, clearing all of its data (used on logout).
 *
 * @returns Nothing.
 */
export function clearSession(): void {
	current().destroy();
}

/**
 * Reads the authenticated account id from the session.
 *
 * @returns The account id, or `null` if the request is unauthenticated.
 */
export function getAccountId(): string | null {
	return getSessionData().accountId ?? null;
}
