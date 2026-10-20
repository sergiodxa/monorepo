/**
 * The sign-in host's session cookie: an HTTP artifact carrying the bearer token a
 * `resolveSession` call looks up, kept separate from the tenant object's session
 * record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/**
 * The cookie's name is `__Host-`-prefixed, which is what requires `Secure`, forbids a
 * `Domain` attribute, and forces `Path=/` below.
 */
export const sessionCookie = createCookie("__Host-session", {
	httpOnly: true,
	secure: true,
	sameSite: "Lax",
	path: "/",
	secrets: [env.SESSION_SECRET],
});
