/**
 * Middleware publishing the host's database as `ctx.db`.
 *
 * The host binds one database when it builds the router, and every controller and
 * middleware under it reads that database off the context it was already handed, so
 * a test drives the same chain by installing this middleware with a database of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Where the database lives on a request context, and the key a test reads it back from. */
export const Database = createContextKey<DataTable>();

/**
 * Reaches consuming projects through their own compilation of this
 * imported file, keeping the `RequestContext` extension available
 * wherever this middleware is used.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The tenant's database, published by the router's `database()` middleware. */
		db: DataTable;
	}
}

/**
 * Publishes the database for the request about to run.
 *
 * @param source - Hands over the database, called per request so the binding is read
 * when one arrives rather than when this module loads.
 * @returns The middleware, for a router's chain.
 * @example
 * let middleware: Middleware[] = [database(() => db), log() as Middleware];
 */
export default function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
