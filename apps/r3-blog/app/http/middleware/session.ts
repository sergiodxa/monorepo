import middleware from "@pkg/remix-helpers/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/session-middleware";

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
export default middleware((ctx, next) => {
	let sessionMiddleware = cachedSessionMiddleware;

	if (!sessionMiddleware) {
		sessionMiddleware = createSessionMiddleware();
		cachedSessionMiddleware = sessionMiddleware;
	}

	return sessionMiddleware(ctx, next);
});

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
