/**
 * Opens the app's D1 connection, once per isolate, for every request, job and queue
 * message that reads or writes a row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

/** The isolate's connection, opened by whichever unit of work reaches it first. */
let database: Database | undefined;

/**
 * Opens a connection to the app's D1 database.
 *
 * `now` is overridden to epoch-ms because the timestamp columns are `c.integer()` holding
 * milliseconds since the epoch, matching the rows already in the database: D1 binds an
 * integer, and integers sort and compare correctly against every row already stored.
 *
 * @returns A database bound to the `DB` binding, shared by everything this isolate serves.
 * @example
 * let middleware = [database(createDatabase)];
 */
export function createDatabase(): Database {
	return (database ??= new Database(createD1DatabaseAdapter(env.DB), { now: () => Date.now() }));
}
