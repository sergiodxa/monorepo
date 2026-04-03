import middleware from "@pkg/remix-helpers/middleware";
import { Database } from "remix/data-table";

export default function createDatabaseMiddleware(database: Database) {
	return middleware((ctx) => {
		ctx.set(Database, database);
	});
}
