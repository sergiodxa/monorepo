/**
 * The sign-in host's magic-link nonce cookie: an HTTP artifact carrying the raw
 * value `beginMagicLinkSignIn` binds a token and a code to, so only the browser
 * that asked can complete either one. Kept as its own cookie under its own secret
 * rather than folded into `session-cookie.ts`, the same way `trusted-device-cookie.ts`
 * is: a stolen nonce only ever lets someone try to complete a sign-in already
 * bound to it, while a stolen session token is the session itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { randomToken } from "@sdxc/crypto";
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/**
 * `__Host-`-prefixed for the same reason `session-cookie.ts` and
 * `trusted-device-cookie.ts` are: it forces `Secure`, forbids `Domain`, and forces
 * `Path=/`. `Max-Age` runs for the ten minutes a minted token and code both stand.
 */
export const magicLinkNonceCookie = createCookie("__Host-magic-link", {
	httpOnly: true,
	secure: true,
	sameSite: "Lax",
	path: "/",
	secrets: [env.MAGIC_LINK_NONCE_SECRET],
});

/** How long the cookie stands, matching the token and code's own expiry. */
const MAGIC_LINK_NONCE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Mints a fresh 256-bit nonce for a request beginning a magic-link sign-in. Only
 * its hash ever reaches the tenant object; the raw value travels solely in this
 * cookie, so the browser never has to read anything back to prove it is the one
 * that asked.
 *
 * @returns A URL-safe random nonce.
 */
export function mintMagicLinkNonce(): string {
	return randomToken({ bytes: 32 });
}

/**
 * Serializes the `__Host-magic-link` cookie for a nonce `mintMagicLinkNonce` just
 * minted.
 *
 * @param nonce - The plaintext nonce to carry; only its hash is ever stored.
 * @returns The `Set-Cookie` header value to append to the response.
 */
export function serializeMagicLinkNonceCookie(nonce: string): Promise<string> {
	return magicLinkNonceCookie.serialize(nonce, { maxAge: MAGIC_LINK_NONCE_MAX_AGE_SECONDS });
}

/**
 * Reads the request's magic-link nonce, if any, for `completeMagicLinkSignIn` and
 * `cancelMagicLinkAttempt` to check against the attempt they act on.
 *
 * @param request - The incoming request.
 * @returns The nonce, or `null` when the request carries none.
 */
export function readMagicLinkNonce(request: Request): Promise<string | null> {
	return magicLinkNonceCookie.parse(request.headers.get("Cookie"));
}
