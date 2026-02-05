import { uuid } from "./uuid";

/**
 * Creates a primary key column with automatic UUID generation
 */
export function pk<T extends string>(name: T) {
	return uuid(name)
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
}
