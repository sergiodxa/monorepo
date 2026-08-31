/**
 * Cookie-based session handling: a signed cookie carries the session id while
 * the values live in KV for a year, so login state survives across requests and
 * across isolates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";

import { getEnv } from "~/app/http/middleware/env";
import { KVSessionStorage } from "~/app/infrastructure/session/kv-session-storage-adapter";

/**
 * Session payload types for cookie-backed sessions.
 */
export namespace SessionMiddleware {
	/**
	 * Values kept for the lifetime of a signed-in session.
	 */
	export interface Values extends Record<string, unknown> {
		userId?: string;
	}
}

const SESSION_COOKIE_NAME = "r3:session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const SESSION_PREFIX = "session:";

let cachedSessionMiddleware: ReturnType<typeof createSessionMiddleware> | null = null;

/**
 * Attaches session handling to every request. The underlying middleware is
 * built on first use because its cookie secret comes from request-scoped env
 * bindings, then reused by later requests.
 */
let sessionMiddleware: Middleware = (ctx, next) => {
	let sessionMiddleware = cachedSessionMiddleware;

	if (!sessionMiddleware) {
		sessionMiddleware = createSessionMiddleware();
		cachedSessionMiddleware = sessionMiddleware;
	}

	return sessionMiddleware(ctx, next);
};

export default sessionMiddleware;

function createSessionMiddleware() {
	let sessionCookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: getEnv("IS_PROD"),
		secrets: [getEnv("COOKIE_SESSION_SECRET", "s3cr3t")],
	});

	return session(
		sessionCookie,
		new KVSessionStorage<SessionMiddleware.Values>(getEnv("AUTH"), {
			ttlSeconds: SESSION_TTL_SECONDS,
			prefix: SESSION_PREFIX,
		}),
	);
}
