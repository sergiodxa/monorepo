import type { Database } from "remix/data-table";

import middleware from "../lib/middleware";

/** Attaches the engine's database to the request context as `ctx.db`. */
export default (db: Database) => {
	return middleware((context, next) => {
		context.db = db;
		return next();
	});
};

declare module "remix/fetch-router" {
	export interface RequestContext {
		db: Database;
	}
}
