/**
 * The blog's models bound to a test database, the same registry a request binds, so a test
 * seeds and asserts through the code the app runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { models } from "~/app/models";

/**
 * Binds every model to `db`.
 *
 * @param db A database from `testDatabase()` or `migratedDatabase()`.
 */
export function bindModels(db: Database) {
	return models.bind({ db });
}
