/**
 * The blog's database: a data-table `Database` over the D1 binding, through a D1 adapter,
 * stamping the timestamps it writes itself as ISO strings, the format every table validates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

let instance: Database | undefined;

/** An ISO 8601 UTC timestamp, which data-table writes into `created_at` and `updated_at`. */
function now(): string {
	return new Date().toISOString();
}

/**
 * Opens a database over a D1 binding, the one production uses and the one a test migrated.
 *
 * @param binding The D1 database to read and write through.
 */
export function openDatabase(binding: D1Database): Database {
	return new Database(createD1DatabaseAdapter(binding), { now });
}

/**
 * Opens the connection every repository reads and writes through.
 *
 * @returns The isolate's database, built on the first call and reused after it.
 * @example
 * createRouter({ middleware: [database(createDatabase)] });
 */
export function createDatabase(): Database {
	return (instance ??= openDatabase(env.DB));
}
