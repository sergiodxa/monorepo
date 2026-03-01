import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createD1DatabaseAdapter } from "~/lib/d1-adapter";
import middleware from "~/lib/middleware";

declare module "remix/fetch-router" {
	interface RequestContext {
		db: Database;
	}
}

let db: Database | null = null;

export default middleware((context, next) => {
	if (!db) {
		let adapter = createD1DatabaseAdapter(env.PLATFORM_DB);
		db = createDatabase(adapter);
	}
	context.db = db;
	return next();
});
