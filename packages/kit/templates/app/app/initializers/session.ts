/**
 * The visitor's session: a signed, httpOnly cookie naming a record in the `SESSIONS` KV store.
 * The page middleware loads it as `ctx.session` and saves it after the controller runs, so a
 * page reads and writes values, flash messages included, without touching the cookie.
 */

import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/** How long a session lasts after its last change, as both the cookie's and the record's lifetime. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Signed with `SESSION_SECRET`; set it with `cf workers secrets update` before deploying.
 * `Secure` follows the request's scheme, so the cookie also works over `http://localhost`.
 */
export const sessionCookie = createCookie("__session", {
	path: "/",
	httpOnly: true,
	sameSite: "Lax",
	maxAge: SESSION_TTL_SECONDS,
	secrets: [env.SESSION_SECRET],
});

/** Session records, under `session:<id>` keys that expire with the cookie. */
export const sessionStorage = new KVSessionStorage(env.SESSIONS, {
	ttlSeconds: SESSION_TTL_SECONDS,
});
