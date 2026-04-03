import middleware from "@pkg/remix-helpers/middleware";
import { Database } from "remix/data-table";

/**
 * Creates middleware that injects the app database into the request context.
 *
 * @param database Database instance shared by downstream handlers.
 * @returns Middleware that stores `database` under the `Database` token.
 */
export default function createDatabaseMiddleware(database: Database) {
	return middleware((ctx) => {
		ctx.set(Database, database);
	});
}
