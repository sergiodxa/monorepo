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
	idToken?: string;
	auth?: AuthTransaction;
}

const SESSION_COOKIE = "blog_saas_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Builds the dashboard session middleware backed by Remix's signed-cookie session
 * storage (`remix/session-middleware` + `createCookieSessionStorage`). The cookie is
 * signed with the platform secret, so a tampered payload fails verification and reads
 * back as an empty session.
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

/** The current request's session (requires the session middleware). */
function current(): Session {
	let ctx = getContext();
	if (!ctx.has(Session)) throw new Error("Session middleware is not installed.");
	return ctx.get(Session) as Session;
}

/** Reads the current session data, validating each field's shape defensively. */
export function getSessionData(): SessionData {
	let store = current();
	let data: SessionData = {};
	let accountId = store.get("accountId");
	if (typeof accountId === "string") data.accountId = accountId;
	let idToken = store.get("idToken");
	if (typeof idToken === "string") data.idToken = idToken;
	let auth = store.get("auth");
	if (auth && typeof auth === "object") data.auth = auth as AuthTransaction;
	return data;
}

/** Mutates the session data; keys set to `undefined` are removed. */
export function updateSessionData(patch: Partial<SessionData>): void {
	let store = current();
	for (let key of ["accountId", "idToken", "auth"] as const) {
		if (!(key in patch)) continue;
		let value = patch[key];
		if (value === undefined) store.unset(key);
		else store.set(key, value);
	}
}

/** Clears the session. */
export function clearSession(): void {
	current().destroy();
}

/** The authenticated account id, or null. */
export function getAccountId(): string | null {
	return getSessionData().accountId ?? null;
}
