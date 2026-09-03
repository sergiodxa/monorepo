/**
 * Publishes the control-plane database every job reads and writes, so a handler takes
 * `ctx.database` and a test hands it one of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@pkg/jobs-next";

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { env } from "cloudflare:workers";
import { Database as DataTable } from "remix/data-table";
import { createContextKey } from "remix/router";

/** The control-plane database, published as `ctx.database`. */
export const Database = createContextKey<DataTable>();

/**
 * Opens the control-plane database over the D1 binding.
 *
 * @returns A database reading and writing `PLATFORM_DB`.
 */
export function createDatabase(): DataTable {
	return new DataTable(createD1DatabaseAdapter(env.PLATFORM_DB));
}

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
