/**
 * The board's models bound outside a request, with the factories that write through them, so
 * a test reads and seeds rows through the same models the app uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createFactories } from "@sdxc/data-model/testing";

import { models } from "~/app/models";

/**
 * Binds the models to `db` and builds the factories that write through them.
 *
 * @param db The database the test drives the app against.
 */
export async function bindModels(db: Database) {
	let bound = models.bind({ db });
	return { models: bound, factories: createFactories(bound, { seed: 1 }) };
}
