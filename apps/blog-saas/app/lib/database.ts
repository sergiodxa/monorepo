/**
 * Opens the control-plane database over the platform's D1 binding, memoized so every
 * unit of work an isolate serves shares one connection.
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
 * Opens the control-plane database, reading the binding on the first call so importing
 * this module touches none.
 *
 * @returns A database reading and writing `PLATFORM_DB`.
 * @example createRouter({ middleware: [database(createDatabase)] });
 */
export function createDatabase(): Database {
	return (database ??= new Database(createD1DatabaseAdapter(env.PLATFORM_DB)));
}
