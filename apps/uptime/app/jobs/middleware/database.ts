/**
 * Job middleware that opens the app's database and publishes it on the context, so a
 * handler reads `ctx.database` and names no container, and a test hands one in instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@pkg/jobs-next";
import type { Database as DataTable } from "remix/data-table";

import { createContextKey } from "remix/router";

import { createDatabase } from "~/app/lib/container";

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
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [costLedger(), database()] });
 */
export function database(): JobMiddleware<DatabaseEffect> {
	return async (ctx, next) => {
		ctx.set(Database, createDatabase(), { property: "database" });
		await next();
	};
}
