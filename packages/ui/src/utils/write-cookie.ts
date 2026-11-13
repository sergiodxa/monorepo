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

/** Options for {@link writeCookie}. */
export interface WriteCookieOptions {
	/** Seconds the cookie stays valid. @default ONE_YEAR_SECONDS */
	maxAgeSeconds?: number;
	/** The path the browser sends the cookie under, such as one app's own prefix. @default "/" */
	path?: string;
}

/**
 * Writes `value` under `name` into a `samesite=lax` cookie, so the next full navigation's server
 * render can read it back and start already in the same state, ahead of hydration ever running.
 *
 * @param name Cookie name to write the value under.
 * @param value Value to persist, interpolated as is, so a boolean persists as `"true"`/`"false"`.
 * @param options How long the cookie lasts and which path it is sent under.
 * @example writeCookie("app-sidebar:collapsed", true);
 * @example writeCookie("ui:announcement-dismissed", true, { maxAgeSeconds: 60 * 60 * 24 * 7 });
 * @example writeCookie("crm-sidebar", false, { path: "/crm" });
 */
export function writeCookie(
	name: string,
	value: string | boolean,
	options: WriteCookieOptions = {},
): void {
	let { maxAgeSeconds = ONE_YEAR_SECONDS, path = "/" } = options;
	document.cookie = `${name}=${value}; path=${path}; max-age=${maxAgeSeconds}; samesite=lax`;
}
