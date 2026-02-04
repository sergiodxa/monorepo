import { text } from "drizzle-orm/sqlite-core";

const ID_LENGTH = 36;

/**
 * Creates a text column for UUID identifiers with unique constraint
 */
export function id<T extends string>(name: T) {
	return text(name, { mode: "text", length: ID_LENGTH }).unique();
}
