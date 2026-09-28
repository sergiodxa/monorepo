/**
 * Job middleware that opens the board's database and publishes it on the context, so a
 * handler reads `ctx.database` and a test hands one in instead of reaching for a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { createContextKey } from "remix/router";

/** Where a job's database lives on the context, installed as `ctx.database`. */
export const Database = createContextKey<DataTable>();

/** What {@link database} publishes, which is what types `ctx.database` for handlers. */
export type DatabaseEffect = {
	key: typeof Database;
	value: DataTable;
	property: "database";
};

/**
 * Publishes a database for the job about to run.
 *
 * @param source Opens the database when the job runs, so a test supplies its own.
 * @returns The middleware, for a dispatcher's chain.
 */
export function database(source: () => DataTable): JobMiddleware<DatabaseEffect> {
	return async (ctx, next) => {
		ctx.set(Database, source(), { property: "database" });
		await next();
	};
}
