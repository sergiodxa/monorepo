/**
 * Router middleware publishing a `remix/data-table` database on the request context as
 * `ctx.db`, so a handler, an MCP tool or a later middleware reads the database off the
 * context it was given and a test installs its own by passing a different instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** The database the `database()` middleware published for this request. */
		db: DataTable;
	}
}

/**
 * Reads the published database by key, for code holding a context whose middleware chain is
 * not known. The type is written out because an exported key needs a nameable type to reach a
 * published declaration file.
 */
export const Database: { defaultValue?: DataTable } = createContextKey<DataTable>();

/** How `database()` installs the instance on the context. */
const DB_PROPERTY = { property: "db" } as const;

/**
 * Creates middleware that publishes `db` as `ctx.db` and under the {@link Database} key. Every
 * request the middleware runs for receives this same instance.
 *
 * @param db The database handlers read for the requests this middleware runs on.
 * @returns Middleware whose context transform types `ctx.db` on a router built from it.
 * @example let router = createRouter({ middleware: [database(db)] });
 */
export function database(
	db: DataTable,
): Middleware<{ key: typeof Database; value: DataTable; property: "db" }> {
	return (ctx, next) => {
		ctx.set(Database, db, DB_PROPERTY);
		return next();
	};
}
