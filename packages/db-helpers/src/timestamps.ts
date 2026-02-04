import { integer } from "drizzle-orm/sqlite-core";

/**
 * Creates a timestamp column stored as milliseconds since epoch
 */
export function timestamp<T extends string>(name: T) {
	return integer(name, { mode: "timestamp_ms" });
}
