/**
 * The `If-Modified-Since` side of conditional requests: reading the date a
 * client claims its copy was made, and comparing it against a modification time
 * at the second precision the header can express.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseHttpDate } from "./http-date.js";

/** Milliseconds in the one second an HTTP-date can express. */
const SECOND_MS = 1000;

/**
 * Truncates a time to whole seconds, the only precision an HTTP-date carries.
 *
 * Comparing raw milliseconds would flag a same-second write as modified,
 * forcing a full body for a copy that is already byte-identical.
 */
function toWholeSeconds(value: Date | number): number {
	let time = value instanceof Date ? value.getTime() : value;
	return Math.floor(time / SECOND_MS);
}

/**
 * Reads the `If-Modified-Since` date from a request's headers.
 *
 * @param headers - Headers of the incoming request.
 * @returns The date the client stored its copy, or `null` when the header is
 * absent or not a valid HTTP-date.
 *
 * @example
 * let since = ifModifiedSince(request.headers);
 * if (since !== null && !isModifiedSince(article.updatedAt, since)) return notModified();
 */
export function ifModifiedSince(headers: Headers): Date | null {
	return parseHttpDate(headers.get("If-Modified-Since"));
}

/**
 * Whether a resource changed after the copy a client already holds.
 *
 * Both times are compared as whole seconds, so a modification in the same
 * second as the client's copy counts as unmodified, keeping repeat requests cheap.
 *
 * @param modifiedAt - When the resource last changed.
 * @param since - The date the client sent in `If-Modified-Since`.
 * @returns `true` when the resource is newer and the full body must be sent.
 *
 * @example
 * isModifiedSince(new Date("2015-10-21T07:28:01Z"), new Date("2015-10-21T07:28:00Z")); // true
 * @example
 * isModifiedSince(new Date("2015-10-21T07:28:00Z"), new Date("2015-10-21T07:28:00Z")); // false
 */
export function isModifiedSince(modifiedAt: Date | number, since: Date | number): boolean {
	return toWholeSeconds(modifiedAt) > toWholeSeconds(since);
}
