/**
 * The cookie-write every mixin persisting client-side state across a full
 * page navigation repeats on its own: a Sidebar's collapsed flag, a theme
 * switch's active mode, or any other single value a mixin mirrors into a
 * cookie so the next server render can read it back and start already in the
 * same state, ahead of hydration ever running.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Seconds a cookie written by {@link writeCookie} stays valid when a call
 * omits `maxAgeSeconds` — a year, long enough that a returning visitor's
 * persisted state outlives typical browsing gaps.
 */
export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Writes `value` under `name` into a `path=/`, `samesite=lax` cookie, so the
 * next full navigation's server render can read it back and start already in
 * the same state, ahead of hydration ever running.
 *
 * @param name Cookie name to write the value under.
 * @param value Value to persist — interpolated directly into the cookie
 * string, so a boolean persists as `"true"`/`"false"` and a string persists
 * as-is.
 * @param maxAgeSeconds Seconds the cookie stays valid before a browser drops
 * it. Defaults to {@link ONE_YEAR_SECONDS}.
 * @example
 * writeCookie("app-sidebar:collapsed", true);
 * @example
 * writeCookie("ui:theme", "dark");
 * @example
 * writeCookie("ui:announcement-dismissed", true, 60 * 60 * 24 * 7);
 */
export function writeCookie(
	name: string,
	value: string | boolean,
	maxAgeSeconds: number = ONE_YEAR_SECONDS,
): void {
	document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}
