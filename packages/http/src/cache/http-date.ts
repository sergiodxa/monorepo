/**
 * The HTTP-date format on both directions of the wire: producing the value a
 * `Last-Modified` validator carries, and reading back the dates clients send in
 * conditional requests. Only the fixed IMF-fixdate spelling is accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The one date spelling this package reads: `"Wed, 21 Oct 2015 07:28:00 GMT"`.
 *
 * Obsolete RFC 850 and asctime forms fail the match, because a misread date
 * silently turns into a `304` for content that changed.
 */
const HTTP_DATE_PATTERN =
	/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * Formats a modification time as the `Last-Modified` validator for a response.
 *
 * HTTP dates carry whole seconds, so sub-second writes within the same second
 * share a validator; a content-derived `ETag` is the better one when available.
 *
 * @param date - Modification time, as a `Date` or epoch milliseconds.
 * @returns The time as an HTTP-date.
 *
 * @example
 * headers.set("Last-Modified", lastModified(article.updatedAt));
 * @example
 * lastModified(new Date("2015-10-21T07:28:00Z")); // "Wed, 21 Oct 2015 07:28:00 GMT"
 */
export function lastModified(date: Date | number): string {
	return new Date(date).toUTCString();
}

/**
 * Parses an HTTP-date header value, such as the one `If-Modified-Since` carries.
 *
 * A missing header and an unparsable one both return `null`, so callers fall
 * back to serving the full body instead of asserting freshness they cannot prove.
 *
 * @param value - Raw header value, or `null` when the header is absent.
 * @returns The parsed date, or `null` when there is nothing valid to compare.
 *
 * @example
 * parseHttpDate(request.headers.get("If-Modified-Since"));
 * @example
 * parseHttpDate("yesterday"); // null
 */
export function parseHttpDate(value: string | null): Date | null {
	if (value === null) return null;
	if (!HTTP_DATE_PATTERN.test(value)) return null;

	let timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return null;

	return new Date(timestamp);
}
