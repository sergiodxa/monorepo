/**
 * Publishes the app's database as `ctx.db`, so a controller reads its dependency off the
 * context it was already given and a test hands one in by installing this middleware with
 * a database of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Where the database lives on a request context, and the key a test reads it back from. */
export const Database = createContextKey<DataTable>();

declare module "remix/router" {
	interface RequestContext {
		/** The app's database, published by the global `database()` middleware. */
		db: DataTable;
	}
}

/**
 * Publishes the database for the request about to run.
 *
 * @param source - Opens the connection, called per request so the binding is read when
 * one arrives rather than when this module loads.
 * @returns The middleware, for a router's chain.
 * @example
 * let router = createRouter({ middleware: [asyncContext(), database(createDatabase)] });
 */
export function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
