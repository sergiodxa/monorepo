import { text } from "drizzle-orm/sqlite-core";

const UUID_LENGTH = 36;

/**
 * Creates a text column for UUID identifiers with unique constraint
 */
export function uuid<T extends string>(name: T) {
	return text(name, { mode: "text", length: UUID_LENGTH }).unique();
}
