import middleware from "@pkg/remix-helpers/middleware";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";

export default function createDatabaseMiddleware(database: Database) {
	return middleware((ctx) => {
		ctx.set(Database, database);
	});
}

export function db() {
	let db = getContext().get(Database);
	if (db) return db;
	throw new Error("Database not found in context. Make sure to use the database middleware.");
}
