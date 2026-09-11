/**
 * Opens the app's D1 connection and connects its per-statement row counts to the cost
 * ledger (ADR-019, ADR-007), which makes D1 cost priceable per job type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { recordD1Statement } from "~/app/services/cost";

/** The isolate's connection, opened by whichever unit of work reaches it first. */
let database: Database | undefined;

/**
 * Opens a connection to the app's D1 database, counting every statement it runs against
 * the cost ledger of whatever unit of work is running (ADR-019, ADR-007).
 *
 * `now` is overridden to epoch-ms because `database/schema.ts` types timestamp columns
 * as `c.integer()`, and the library's default `now()` returns a `Date`, which D1 cannot
 * bind; `onStatement` reuses the row counts D1 already returns in `meta`.
 *
 * @returns A database bound to the `DB` binding, shared by every request this isolate serves.
 * @example
 * let middleware = [database(createDatabase)];
 */
export function createDatabase(): Database {
	return (database ??= new Database(
		createD1DatabaseAdapter(env.DB, { onStatement: recordD1Statement }),
		{ now: () => Date.now() },
	));
}
