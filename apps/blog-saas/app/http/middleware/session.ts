import type { Middleware } from "remix/fetch-router";

import { getContext } from "remix/async-context-middleware";
import { createCookie } from "remix/cookie";
import { createContextKey } from "remix/fetch-router";

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

interface SessionState {
	data: SessionData;
	dirty: boolean;
}

const SESSION_COOKIE = "blog_saas_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

let sessionKey = createContextKey<SessionState>();

/** Builds the signed-cookie session middleware for the dashboard. */
export function createSessionMiddleware(secret: string, isProd: boolean): Middleware {
	let cookie = createCookie(SESSION_COOKIE, {
		path: "/",
		httpOnly: true,
		sameSite: "Lax",
		secure: isProd,
		maxAge: SESSION_MAX_AGE,
		secrets: [secret],
	});

	return async (context, next) => {
		let parsed = (await cookie.parse(context.request.headers.get("cookie"))) as SessionData | null;
		let state: SessionState = { data: parsed ?? {}, dirty: false };
		context.set(sessionKey, state);

		let response = await next();
		if (!state.dirty) return response;

		let result = new Response(response.body, response);
		result.headers.append("set-cookie", await cookie.serialize(state.data));
		return result;
	};
}

function state(): SessionState {
	let ctx = getContext();
	if (!ctx.has(sessionKey)) throw new Error("Session middleware is not installed.");
	return ctx.get(sessionKey) as SessionState;
}

/** Reads the current session data. */
export function getSessionData(): SessionData {
	return state().data;
}

/** Mutates the session data and marks it for persistence. */
export function updateSessionData(patch: Partial<SessionData>): void {
	let current = state();
	current.data = { ...current.data, ...patch };
	current.dirty = true;
}

/** Clears the session. */
export function clearSession(): void {
	let current = state();
	current.data = {};
	current.dirty = true;
}

/** The authenticated account id, or null. */
export function getAccountId(): string | null {
	return getSessionData().accountId ?? null;
}
