/**
 * Publishes the control-plane database every job reads and writes, so a handler takes
 * `ctx.database` and a test hands it one of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { createContextKey } from "remix/router";

import { createDatabase } from "~/app/lib/database";

/** The control-plane database, published as `ctx.database`. */
export const Database = createContextKey<DataTable>();

/**
 * Publishes the control-plane database for the job about to run.
 *
 * @returns The middleware installing it as `ctx.database`.
 * @example createJobDispatcher({ middleware: [database()] });
 */
export function database(): JobMiddleware<{
	key: typeof Database;
	value: DataTable;
	property: "database";
}> {
	return async (ctx, next) => {
		ctx.set(Database, createDatabase(), { property: "database" });
		await next();
	};
}
