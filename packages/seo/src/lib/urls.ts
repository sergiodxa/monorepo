/**
 * URL resolution every other part of the package builds on: reducing a configured
 * base URL to its origin, resolving any request URL or path into the single canonical
 * URL a page advertises, and turning asset paths absolute. It exists so the origin and
 * trailing-slash rules are decided in exactly one tested place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Reduces a configured base URL to the scheme, host, and port every canonical and
 * absolute URL is built from, with no trailing slash so values concatenate cleanly.
 * Any path prefix is dropped, since resolution always works from root-relative paths.
 *
 * @param baseUrl - The site's canonical base URL, as a string or `URL`.
 * @returns The origin, e.g. `"https://example.com"`.
 * @example normalizeBaseUrl("https://example.com/") // "https://example.com"
 */
export function normalizeBaseUrl(baseUrl: string | URL): string {
	return new URL(baseUrl).origin;
}

/**
 * Resolves any URL or path to the one canonical URL its page advertises, ignoring
 * which host served the request, with the trailing slash dropped everywhere but
 * the root so a page never claims two canonical URLs; query strings stay verbatim.
 *
 * @param baseUrl - Normalized origin from {@link normalizeBaseUrl}.
 * @param url - Absolute request URL, or a root-relative path.
 * @returns The canonical absolute URL as a string.
 * @example canonicalUrl("https://example.com", "https://preview.workers.dev/features/") // "https://example.com/features"
 * @example canonicalUrl("https://example.com", "/search?q=schema") // "https://example.com/search?q=schema"
 */
export function canonicalUrl(baseUrl: string, url: string | URL): string {
	let { pathname, search } = new URL(url, baseUrl);
	let canonical = new URL(`${pathname}${search}`, baseUrl).toString();
	if (canonical !== `${baseUrl}/` && canonical.endsWith("/")) return canonical.slice(0, -1);
	return canonical;
}

/**
 * Resolves an asset path against the configured origin, leaving already-absolute
 * URLs (a CDN host, an external profile) untouched, with the path passed through
 * exactly as given since asset URLs carry meaning of their own.
 *
 * @param baseUrl - Normalized origin from {@link normalizeBaseUrl}.
 * @param path - Root-relative path, or an already-absolute URL.
 * @returns The absolute URL as a string.
 * @example absoluteUrl("https://example.com", "/og/cover.png") // "https://example.com/og/cover.png"
 */
export function absoluteUrl(baseUrl: string, path: string | URL): string {
	return new URL(path, baseUrl).toString();
}
