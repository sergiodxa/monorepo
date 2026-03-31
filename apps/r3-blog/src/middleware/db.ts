import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { createDatabase, type Database } from "remix/data-table";
import { createStorageKey } from "remix/fetch-router";

import { createD1DataTableAdapter } from "~/lib/data-table-d1-adapter";

const key = createStorageKey<Database>();

export default () => {
	let db = createDatabase(createD1DataTableAdapter(env.DB));

	return middleware((ctx) => {
		ctx.storage.set(key, db);
	});
};

export function db() {
	let db = getContext().storage.get(key);
	if (db) return db;
	throw new Error("Database not found in context. Make sure to use the database middleware.");
}
