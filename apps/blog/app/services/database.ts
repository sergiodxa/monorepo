/**
 * The blog's database: a data-table `Database` over the D1 binding, through a D1 adapter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

let instance: Database | undefined;

/**
 * Opens the connection every repository reads and writes through.
 *
 * @returns The isolate's database, built on the first call and reused after it.
 * @example
 * createRouter({ middleware: [database(createDatabase)] });
 */
export function createDatabase(): Database {
	return (instance ??= new Database(createD1DatabaseAdapter(env.DB)));
}
