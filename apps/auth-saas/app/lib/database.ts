/**
 * Opens the app's connection to the platform D1 database, shared by every unit of work
 * the isolate serves.
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
 * Opens a connection to the platform database, memoized so every request this isolate
 * serves shares the one connection.
 *
 * @returns A database bound to the `PLATFORM_DB` binding.
 * @example
 * let middleware = [database(createDatabase)];
 */
export function createDatabase(): Database {
	return (database ??= new Database(createD1DatabaseAdapter(env.PLATFORM_DB)));
}
