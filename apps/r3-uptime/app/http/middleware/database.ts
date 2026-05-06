import middleware from "@pkg/remix-helpers/middleware";
import { Database } from "remix/data-table";

export default (db: Database) => {
	return middleware((ctx, next) => {
		ctx.set(Database, db);
		return next();
	});
};
