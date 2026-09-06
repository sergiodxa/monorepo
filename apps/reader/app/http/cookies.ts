/**
 * The standalone, non-session cookies the HTTP layer reads and writes. They live outside
 * the session because both must survive a request that has no session yet: the sign-in
 * redirect leaves the origin entirely, and a language is resolved before anybody is known.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";

/**
 * Remembers the page an anonymous visitor was trying to reach, so the auth callback lands
 * them there. Left unsigned: the value is narrowed to a same-origin relative path before
 * use, so tampering can only redirect within this app.
 */
export const RETURN_TO_COOKIE = createCookie("reader:return-to", {
	path: "/",
	maxAge: 60 * 5,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/** Remembers the visitor's chosen interface language for a year. */
export const LANGUAGE_COOKIE = createCookie("reader:language", {
	path: "/",
	maxAge: 60 * 60 * 24 * 365,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});
