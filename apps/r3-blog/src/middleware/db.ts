import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";
import { createDatabase, type Database } from "remix/data-table";
import { createStorageKey, RequestContext } from "remix/fetch-router";

import { createD1DatabaseAdapter } from "~/lib/data-table-d1-adapter";

const key = createStorageKey<Database>();

export default () => {
	let db = createDatabase(createD1DatabaseAdapter(env.DB));

	return middleware((ctx) => {
		ctx.storage.set(key, db);
	});
};

export function db(ctx: RequestContext) {
	let db = ctx.storage.get(key);
	if (db) return db;
	throw new Error("Database not found in context. Make sure to use the database middleware.");
}
