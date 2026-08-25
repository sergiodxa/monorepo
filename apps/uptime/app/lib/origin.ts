/**
 * The origin every link inside an email points at, and the one helper that builds those
 * links from a route's `href()`.
 *
 * Fixed as a constant because the senders that need it have no request: the check jobs,
 * the queue consumer and the scheduled digests all run with no `Host` header to trust and
 * no `ctx.url` to read. Keeping it in one module gives an alert, a digest and an
 * unsubscribe footer the same hostname even after a domain change.
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
