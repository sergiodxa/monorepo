import { type ReferenceConfig, text } from "drizzle-orm/sqlite-core";

const UUID_LENGTH = 36;

/**
 * Creates a foreign key column that references another table's primary key
 * with cascade delete and update options
 */
export function fk<T extends string>(name: T, ref: ReferenceConfig["ref"]) {
	return text(name, { mode: "text", length: UUID_LENGTH }).references(ref, {
		onDelete: "cascade",
		onUpdate: "cascade",
	});
}
