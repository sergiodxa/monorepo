/**
 * Database middleware for the r3-uptime fetch-router. It returns a middleware that
 * binds a data-table Database instance into the request context via ctx.set before
 * continuing the chain, making the database available to downstream handlers. It
 * exists to inject the request-scoped database dependency into the pipeline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { Database } from "remix/data-table";

export default (db: Database): Middleware => {
	return (ctx, next) => {
		ctx.set(Database, db);
		return next();
	};
};
