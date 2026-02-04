import { text } from "drizzle-orm/sqlite-core";

const URL_LENGTH = 2048;
// The maximum length of a URL is 2048 characters, according to RFC 3986.
// https://www.rfc-editor.org/rfc/rfc3986#section-2.3

/**
 * Creates a text column for URL storage with RFC 3986 compliant length
 */
export function url<T extends string>(name: T) {
	return text(name, {
		mode: "text",
		length: URL_LENGTH,
	});
}
