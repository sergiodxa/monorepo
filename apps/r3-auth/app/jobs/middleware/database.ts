/**
 * Job middleware that opens the app's database and publishes it on the context, so a
 * handler reads `ctx.database`, and a test hands one in instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { createContextKey } from "remix/router";

import { createDatabase } from "~/app/lib/database";

/** Where the database lives on a job context, and the key a test publishes its own under. */
export const Database = createContextKey<DataTable>();

/** What {@link database} publishes, which is what types `ctx.database` for handlers. */
export type DatabaseEffect = {
	key: typeof Database;
	value: DataTable;
	property: "database";
};

/**
 * Publishes the database as `ctx.database` for the job about to run.
 *
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [database()] });
 */
export function database(): JobMiddleware<DatabaseEffect> {
	return async (context, next) => {
		context.set(Database, createDatabase(), { property: "database" });
		await next();
	};
}
