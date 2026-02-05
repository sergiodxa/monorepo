import { text } from "drizzle-orm/sqlite-core";

/**
 * Maximum email length per RFC 5321
 * @see https://www.rfc-editor.org/rfc/rfc5321#section-4.5.3.1.3
 */
const EMAIL_LENGTH = 254;

/**
 * Creates a text column for email storage with RFC 5321 compliant length
 */
export function email<T extends string>(name: T) {
	return text(name, { mode: "text", length: EMAIL_LENGTH });
}
