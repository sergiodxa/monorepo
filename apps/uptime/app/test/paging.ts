/**
 * Test helper for walking a paginated API response.
 *
 * A paginated endpoint advertises its navigation in `Link` rather than in the body,
 * so a test that wants the next page has to read the header. Parsing it here keeps
 * every paging test asserting on behavior — the next page holds the next rows —
 * instead of re-deriving the header's grammar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Reads one relation's target out of a `Link` header.
 *
 * The path and query come back rather than the whole URL, because that is what the
 * request helpers take; the origin is the test's own and asserting on it would only
 * restate the host the request was made against.
 *
 * @param header The response's `Link` header, or `null` when it sent none.
 * @param rel The relation to look for, `next` by default.
 * @returns The path and query to request, or `null` when no such page is advertised.
 * @example
 * let next = parseLink(response.headers.get("Link"));
 */
export function parseLink(header: string | null, rel = "next"): string | null {
	if (header === null) return null;

	for (let value of header.split(",")) {
		let match = value.match(/^\s*<([^>]*)>\s*;\s*rel="?([^";]+)"?/);
		if (match?.[1] !== undefined && match[2] === rel) {
			let url = new URL(match[1]);
			return `${url.pathname}${url.search}`;
		}
	}

	return null;
}
