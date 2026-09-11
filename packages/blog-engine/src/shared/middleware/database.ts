/**
 * Middleware that publishes the engine's database on the request context, and the
 * module augmentation that types it, so every controller reads `ctx.db` and a test
 * hands in its own database by installing this middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Where a request's database lives on the context, installed as `ctx.db`. */
export const Database = createContextKey<DataTable>();

/**
 * Publishes the blog's database for the request about to run. Takes a factory so the
 * binding is read when a request runs, whether the router is built once or per request.
 *
 * @param source - Returns the database this request reads and writes.
 * @returns The middleware, for the head of a router's chain.
 * @example createRouter({ middleware: [database(() => db)] });
 */
export function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}

declare module "remix/router" {
	interface RequestContext {
		/** The blog's database, published by the global `database()` middleware. */
		db: DataTable;
	}
}
