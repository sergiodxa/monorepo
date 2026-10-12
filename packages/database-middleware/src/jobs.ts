/**
 * Job middleware publishing a `remix/data-table` database on the job context as `ctx.db`, under
 * the same `Database` key the router middleware uses, so a job handler and a request handler
 * read the database the same way and a test installs its own by passing a different instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { Database } from "./index.js";

export { Database } from "./index.js";

/** Installs the database as `ctx.db`, the name the job context and `ctx.get(Database)` share. */
const DB_PROPERTY = { property: "db" } as const;

/**
 * Publishes the database on every job run as `ctx.db`. A function is called once per run, so a
 * dispatcher that outlives a test opens whichever database that run's source returns; the
 * dispatcher's context type carries `ctx.db` from this middleware's transform.
 *
 * @param db The database every job run reads through, or a function opening it for each run.
 * @returns Job middleware setting the database under {@link Database} and as `ctx.db`.
 * @example createJobDispatcher({ middleware: [database(createDatabase)] })
 */
export function database(
	db: DataTable | (() => DataTable),
): JobMiddleware<{ key: typeof Database; value: DataTable; property: "db" }> {
	return async (ctx, next) => {
		ctx.set(Database, typeof db === "function" ? db() : db, DB_PROPERTY);
		await next();
	};
}
