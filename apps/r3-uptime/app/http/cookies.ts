/**
 * Standalone (non-session) cookies used by the HTTP layer: `returnTo`, a short-lived
 * cookie remembering the page an unauthenticated visitor was trying to reach so the
 * auth callback can send them back after signing in (kept out of the URL, which
 * wouldn't survive an external OAuth redirect); and `language`, a long-lived cookie
 * for a visitor's chosen UI language when they're signed out or haven't set an
 * account preference yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";

/**
 * Remembers the path to return to after a successful sign-in. Left unsigned: the
 * value is validated as a same-origin relative path with `safeReturnTo` before use,
 * so tampering can only redirect within the app.
 */
export const returnTo = createCookie("uptime:return-to", {
	path: "/",
	maxAge: 60 * 5, // 5 minutes
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/**
 * Remembers the visitor's chosen UI language for a year, for signed-out visitors and
 * signed-in ones without an explicit account preference.
 */
export const language = createCookie("uptime:language", {
	path: "/",
	maxAge: 60 * 60 * 24 * 365,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/**
 * Narrows a `returnTo` value to a safe same-origin relative path, falling back to
 * `fallback` for anything else (missing, absolute, or protocol-relative `//host`).
 */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
	if (!value) return fallback;
	if (!value.startsWith("/")) return fallback;
	if (value.startsWith("//")) return fallback;
	return value;
}
