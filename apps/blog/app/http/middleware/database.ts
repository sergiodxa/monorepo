/**
 * Middleware publishing the request-scoped database into request context, and the reader
 * that takes it back out.
 *
 * The blog resolves services through `@pkg/service-container`, which suits a handler whose
 * signature the app controls. A handler behind a route-agnostic boundary — an MCP tool, for
 * instance — receives only a context, so for those the database has to be *in* that
 * context. This middleware puts it there, scoped to just the routes that need it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ContextEntries, Middleware, RequestContext } from "remix/router";

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

/**
 * Creates middleware that stores the container's `Database` in request context.
 *
 * @returns Middleware exposing the database as `ctx.db` and `ctx.get(Database)`.
 * @example
 * router.map(routes.mcp, { middleware: [database()], handler: (ctx) => mcp.fetch(ctx) });
 */
export default function database(): Middleware {
	return (ctx, next) => {
		ctx.set(Database, getServiceContainer().get(Database), { property: "db" });
		return next();
	};
}

/**
 * Reads the database out of request context.
 *
 * A missing database signals a wiring mistake fixed once at the route, so
 * this throws with a message naming the fix.
 *
 * @param ctx The request context, whatever middleware it has been through.
 * @returns The request-scoped database.
 * @throws {Error} When {@link database} did not run for this route.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- params are irrelevant to the lookup
export function getDatabase(ctx: RequestContext<any, ContextEntries>): Database {
	let db = ctx.get(Database);
	if (!db) throw new Error("This route is missing its database() middleware");
	return db;
}
