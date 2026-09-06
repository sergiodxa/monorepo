/**
 * Session middleware factory. Builds cookie-based, KV-backed session handling for a
 * request: a one-year, httpOnly, signed cookie whose data lives in KV under a `session:`
 * prefix, so a handler reads and writes through `ctx.get(Session)` without knowing where
 * sessions are persisted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";

const SESSION_COOKIE_NAME = "reader:session";

/** Session lifetime in seconds (one year), matching the KV entry TTL so both expire together. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

const SESSION_PREFIX = "session:";

/**
 * Creates the session middleware, signing its cookie with the given secret and persisting
 * session data in KV under `session:` keys.
 *
 * @param kv - KV namespace backing session storage.
 * @param cookieSecret - Secret used to sign the session cookie.
 * @param secure - Whether the cookie should be marked `Secure` (HTTPS hosts only).
 */
export function createSessionMiddleware(kv: KVNamespace, cookieSecret: string, secure: boolean) {
	let cookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure,
		secrets: [cookieSecret],
	});

	let storage = new KVSessionStorage(kv, {
		ttlSeconds: SESSION_TTL_SECONDS,
		prefix: SESSION_PREFIX,
	});

	return session(cookie, storage);
}
