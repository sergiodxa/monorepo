import { text } from "drizzle-orm/sqlite-core";

/**
 * Maximum URL length per RFC 3986
 * @see https://www.rfc-editor.org/rfc/rfc3986#section-2.3
 */
const URL_LENGTH = 2048;

/**
 * Creates a text column for URL storage with RFC 3986 compliant length
 */
export function url<T extends string>(name: T) {
	return text(name, {
		mode: "text",
		length: URL_LENGTH,
	});
}
