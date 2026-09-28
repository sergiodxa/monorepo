/**
 * Middleware publishing the board's database into request context, so every handler reads
 * `ctx.db`. An MCP tool's handler receives only a context to work with, so installing this
 * globally is what puts the database within reach of both boundaries the app serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Where the request's database lives on the context, published as `ctx.db`. */
export const Database = createContextKey<DataTable>();

declare module "remix/router" {
	interface RequestContext {
		/** The board's database, published by the global `database()` middleware. */
		db: DataTable;
	}
}

/**
 * Creates middleware that publishes the database as `ctx.db`.
 *
 * @param source Opens the database when a request runs, so a test installs its own by
 * handing the router a different source rather than by reaching past the middleware.
 * @returns Middleware exposing the database as `ctx.db` and `ctx.get(Database)`.
 */
export default function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
