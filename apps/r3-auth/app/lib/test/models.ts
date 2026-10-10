/**
 * Test-only models: the app's registry bound to a freshly migrated in-memory database, the
 * same registry a request binds, so a test seeds and asserts through the code the app runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type { AuthModels } from "~/app/models";

import { createTestDatabase } from "~/app/lib/test/db";
import { models } from "~/app/models";

/**
 * Binds every model to `db`.
 *
 * @param db - A database from `createTestDatabase()`.
 */
export function bindModels(db: Database): AuthModels {
	return models.bind({ db });
}

/**
 * Opens a migrated in-memory database and binds the models to it.
 *
 * @returns The database, for a raw read or write a test arranges, and the bound models.
 * @example
 * let { models } = createTestModels();
 */
export function createTestModels(): { db: Database; models: AuthModels } {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db) };
}
