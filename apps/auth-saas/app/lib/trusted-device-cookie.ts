/**
 * The sign-in host's trusted-device cookie: an HTTP artifact carrying the token a
 * `completeSecondFactor` call minted, checked back against a subject's remembered
 * browsers on a later sign-in. Kept as its own cookie under its own secret rather
 * than folded into `session-cookie.ts`: a stolen trusted-device token only ever
 * excuses a factor demand for the subject it names, while a stolen session token is
 * the session itself, and the two are different capabilities worth different keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/**
 * `__Host-`-prefixed for the same reason `session-cookie.ts` is: it forces
 * `Secure`, forbids `Domain`, and forces `Path=/`. `Max-Age` runs for the token's
 * own 30-day window, set by whoever serializes a value.
 */
export const trustedDeviceCookie = createCookie("__Host-trusted-device", {
	httpOnly: true,
	secure: true,
	sameSite: "Lax",
	path: "/",
	secrets: [env.TRUSTED_DEVICE_SECRET],
});

/** How long the cookie stands, matching `totp.ts`'s own `trusted_devices` window. */
const TRUSTED_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Serializes the `__Host-trusted-device` cookie for a token `completeSecondFactor`
 * just minted.
 *
 * @param token - The plaintext token to carry; only its digest is ever stored.
 * @returns The `Set-Cookie` header value to append to the response.
 */
export function serializeTrustedDeviceCookie(token: string): Promise<string> {
	return trustedDeviceCookie.serialize(token, { maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS });
}

/**
 * Reads the request's trusted-device token, if any, for `signInWithPassword` to
 * check against the subject it resolves.
 *
 * @param request - The incoming request.
 * @returns The token, or `null` when the request carries none.
 */
export function readTrustedDeviceToken(request: Request): Promise<string | null> {
	return trustedDeviceCookie.parse(request.headers.get("Cookie"));
}
