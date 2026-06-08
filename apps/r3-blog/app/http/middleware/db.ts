import type { Middleware } from "remix/fetch-router";

import { Database } from "remix/data-table";

/**
 * Creates middleware that injects the app database into the request context.
 *
 * @param database Database instance shared by downstream handlers.
 * @returns Middleware that stores `database` under the `Database` token.
 */
export default function createDatabaseMiddleware(database: Database): Middleware {
	return (ctx, next) => {
		ctx.set(Database, database);
		return next();
	};
}
