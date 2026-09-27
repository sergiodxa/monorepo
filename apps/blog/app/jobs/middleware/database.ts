/**
 * Publishes the blog's database to every job, under the same context key HTTP
 * handlers read, so a handler takes `ctx.db` and a test hands it a database of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { Database } from "~/app/http/middleware/database";
import { createDatabase } from "~/app/services/database";

/**
 * Publishes the database for the job about to run.
 *
 * @returns The middleware installing it as `ctx.db`.
 * @example createJobDispatcher({ middleware: [database()] });
 */
export function database(): JobMiddleware<{
	key: typeof Database;
	value: DataTable;
	property: "db";
}> {
	return async (ctx, next) => {
		ctx.set(Database, createDatabase(), { property: "db" });
		await next();
	};
}
