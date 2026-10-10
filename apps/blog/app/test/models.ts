/**
 * The blog's models bound to a test database, the same registry a request binds, so a test
 * seeds and asserts through the code the app runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Models } from "@sdxc/data-model";

import { models } from "~/app/models";

/**
 * Binds every model to `db`.
 *
 * @param db A database from `testDatabase()` or `migratedDatabase()`.
 */
export function bindModels(db: Database) {
	return models.bind({ db });
}

/**
 * Publishes the models bound to `db` on a job context a test built by hand, the way the
 * dispatcher's `models()` middleware does for a real run.
 *
 * @param ctx The job context a test created with `createJobContext`.
 * @param db The database the job reads.
 */
export function publishModels(
	ctx: { set(key: object, value: unknown, options: { property: string }): void },
	db: Database,
): void {
	ctx.set(Models, bindModels(db), { property: "models" });
}
