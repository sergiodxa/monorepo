/**
 * Middleware that puts the request's `Database` in the request context, so handlers
 * read it with `ctx.get(Database)` instead of importing a module-level connection.
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
