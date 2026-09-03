/**
 * The two middlewares every job runs inside: one opens the container scope the app's
 * services resolve from, the other publishes the database onto the context so a handler
 * reads `ctx.database` and names no container of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";

import { getServiceContainer } from "@sdxc/service-container";
import { Database as DataTable } from "remix/data-table";
import { createContextKey } from "remix/router";

import { container } from "~/app/lib/container";

/** Where the database lives on a job context, and the key a test publishes its own under. */
export const Database = createContextKey<DataTable>();

/**
 * Opens a container scope around the rest of the chain, so everything one delivery
 * resolves — the database below, the background mailer — comes from a scope of its own.
 *
 * @returns The middleware, to be declared before anything that resolves a service.
 */
export function scope(): JobMiddleware {
	return async (_context, next) => {
		await container.scope(() => next());
	};
}

/**
 * Publishes the database as `ctx.database`. Resolved through the active container rather
 * than built here, so a test that registers its own `Database` is what the handler gets.
 *
 * @returns The middleware, to be declared after {@link scope}.
 */
export function database(): JobMiddleware<{
	key: typeof Database;
	value: DataTable;
	property: "database";
}> {
	return async (context, next) => {
		context.set(Database, getServiceContainer().get(DataTable), { property: "database" });
		await next();
	};
}
