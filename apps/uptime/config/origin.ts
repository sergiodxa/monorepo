/**
 * The origin every link inside an email points at, and the one helper that builds those
 * links from a route's `href()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Production origin of the app, and the only host emailed links resolve against. */
export const APP_ORIGIN = "https://uptime.sergiodxa.com";

/**
 * Builds an absolute link from a route's relative path.
 *
 * @param path - Path beginning with a slash, normally from a route's `href()`.
 * @returns The absolute URL.
 * @example absoluteUrl(routes.app.team.account.href({ team: slug }))
 */
export function absoluteUrl(path: string): string {
	return `${APP_ORIGIN}${path}`;
}
