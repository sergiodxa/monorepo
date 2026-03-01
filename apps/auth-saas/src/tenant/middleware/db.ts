import type { Database } from "remix/data-table";

import middleware from "~/lib/middleware";

export default (db: Database) => {
	return middleware((context, next) => {
		context.logger.middleware("db").info("Attaching database to context");
		context.db = db;
		return next();
	});
};

declare module "remix/fetch-router" {
	export interface RequestContext {
		db: Database;
	}
}
