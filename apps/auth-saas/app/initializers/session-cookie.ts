/**
 * The sign-in host's session cookie: an HTTP artifact carrying the bearer token a
 * `resolveSession` call looks up, kept separate from the tenant object's session
 * record. The `__Host-` prefix binds it to one exact host and forbids `Domain`, so no
 * other name under the customer's domain can read or overwrite it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/**
 * The cookie's name is `__Host-`-prefixed, which is what requires `Secure`, forbids a
 * `Domain` attribute, and forces `Path=/` below.
 *
 * `Max-Age` is left for whoever serializes a value: a remembered session sets it to the
 * session's own remaining lifetime, and an unremembered one omits it so the browser
 * clears the cookie when it closes.
 */
export const sessionCookie = createCookie("__Host-session", {
	httpOnly: true,
	secure: true,
	sameSite: "Lax",
	path: "/",
	secrets: [env.SESSION_SECRET],
});
