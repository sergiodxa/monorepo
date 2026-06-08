import type { Middleware } from "remix/fetch-router";

import { Database } from "remix/data-table";

export default (db: Database): Middleware => {
	return (ctx, next) => {
		ctx.set(Database, db);
		return next();
	};
};
