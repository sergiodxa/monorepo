/**
 * HTTP middleware that attaches cookie-based, KV-backed session handling to each
 * request. It defines the session value shape, cookie name, one-year TTL, and KV
 * prefix, and lazily builds a singleton session middleware wired to a signed
 * cookie and `KVSessionStorage`. Exists to persist login state across requests.
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
 * Groups session payload types used by this middleware.
 */
export namespace SessionMiddleware {
	/**
	 * Represents values persisted in each user session.
	 */
	export interface Values extends Record<string, unknown> {
		userId?: string;
		idToken?: string;
	}
}

/**
 * Cookie name used to read and persist session IDs.
 */
const SESSION_COOKIE_NAME = "r3:session";
/**
 * Session lifetime in seconds (one year).
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
/**
 * Key prefix for session entries stored in KV.
 */
const SESSION_PREFIX = "session:";

/**
 * Cached singleton middleware instance reused across requests.
 */
let cachedSessionMiddleware: ReturnType<typeof createSessionMiddleware> | null = null;

/**
 * Attaches session handling to requests with a lazily created singleton.
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

/**
 * Creates the session middleware with cookie and KV-backed storage.
 */
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
