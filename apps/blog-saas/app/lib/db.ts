import type { Database } from "remix/data-table";

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { env } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

let cached: Database | null = null;

/** Returns the control-plane D1 database (created once per isolate). */
export function platformDb(): Database {
	if (!cached) cached = createDatabase(createD1DatabaseAdapter(env.PLATFORM_DB));
	return cached;
}
