import { id } from "./id";

/**
 * Creates a primary key column with automatic UUID generation
 */
export function pk<T extends string>(name: T) {
	return id(name)
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
}
