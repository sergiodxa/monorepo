import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { createDatabase, type Database } from "remix/data-table";
import { createContextKey, type MergeContext, type RequestContext } from "remix/fetch-router";

import { createD1DataTableAdapter } from "~/lib/data-table-d1-adapter";

export const dbKey = createContextKey<Database>();

export type DBContextTransform = readonly [readonly [typeof dbKey, Database]];

export type WithDB<context extends RequestContext<any, any>> = MergeContext<
	context,
	DBContextTransform
>;

export default () => {
	let db = createDatabase(createD1DataTableAdapter(env.DB));

	return middleware<"ANY", Record<string, any>, DBContextTransform>((ctx) => {
		ctx.set(dbKey, db);
	});
};

export function db() {
	let db = getContext().get(dbKey);
	if (db) return db;
	throw new Error("Database not found in context. Make sure to use the database middleware.");
}
