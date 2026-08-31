/**
 * The dashboard session middleware and its typed accessors: a signed-cookie session
 * carrying the authenticated account id alongside the token set the OIDC client keeps
 * there. Signing makes the payload readable in the browser and tamper-evident here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createCookie } from "remix/cookie";
import { getContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { Session } from "remix/session";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

/** The dashboard's own entry in the signed-cookie session payload. */
export interface SessionData {
	accountId?: string;
}

const SESSION_COOKIE = "blog_saas_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Builds the dashboard session middleware backed by Remix's signed-cookie session
 * storage, signed with the platform secret so a tampered payload fails verification
 * and reads back as an empty session.
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
 * Reads the dashboard's session entry, validating its runtime shape so callers always
 * receive well-formed values, even from a malformed cookie.
 *
 * @returns The validated session data (fields absent when missing or invalid).
 */
function getSessionData(): SessionData {
	let store = current();
	let data: SessionData = {};
	let accountId = store.get("accountId");
	if (typeof accountId === "string") data.accountId = accountId;
	return data;
}

/**
 * Records the account a completed login resolved, which is what every dashboard route
 * reads the current viewer from.
 *
 * @param accountId The local account id to store.
 * @returns Nothing.
 */
export function setAccountId(accountId: string): void {
	current().set("accountId", accountId);
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
