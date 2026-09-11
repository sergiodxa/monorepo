/**
 * Middleware publishing the app's database into request context, so every handler reads
 * `ctx.db`.
 *
 * A handler behind a route-agnostic boundary — an MCP tool, for instance — receives only a
 * context to work with, so the database has to be *in* that context. Installing this
 * globally puts it there for every route, whichever boundary the handler sits behind.
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
		/** The app's database, published by the global `database()` middleware. */
		db: DataTable;
	}
}

/**
 * Creates middleware that publishes the database as `ctx.db`.
 *
 * @param source Opens the database when a request runs, so the binding it reads is the one
 * that request was served with, whether the router is built once or per request.
 * @returns Middleware exposing the database as `ctx.db` and `ctx.get(Database)`.
 * @example
 * createRouter({ middleware: [database(createDatabase)] });
 */
export default function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
