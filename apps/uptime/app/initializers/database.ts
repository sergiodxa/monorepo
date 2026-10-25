/**
 * Opens the app's D1 connection and connects its per-statement row counts to the cost
 * ledger, which makes D1 cost priceable per job type.
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
 * the cost ledger of whatever unit of work is running.
 *
 * @returns A database bound to the `DB` binding, shared by every request this isolate serves.
 * @example
 * let middleware = [database(openDatabase())];
 */
export function openDatabase(): Database {
	return (database ??= new Database(
		createD1DatabaseAdapter(env.DB, { onStatement: recordD1Statement }),
		{ now: () => Date.now() },
	));
}
