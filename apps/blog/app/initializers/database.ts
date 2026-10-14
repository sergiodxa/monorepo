/**
 * The blog's database: a data-table `Database` over the D1 binding, through a D1 adapter,
 * stamping the timestamps it writes itself as ISO strings, the format every table validates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { D1StatementObservation } from "@sdxc/data-table-d1";

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { currentLog } from "@sdxc/logger";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

let instance: Database | undefined;

/** An ISO 8601 UTC timestamp, which data-table writes into `created_at` and `updated_at`. */
function now(): string {
	return new Date().toISOString();
}

/**
 * Totals what each statement cost D1 on the running request's or job's wide event, so a page
 * whose queries grow slower or read more rows shows up as a trend on its `route`. `duration_ms`
 * is the time D1 reports spending on the SQL, excluding the round trip to reach it.
 *
 * @param observation The counts and duration D1 reported for one statement.
 */
export function recordStatement(observation: D1StatementObservation): void {
	currentLog()
		?.inc("d1.count")
		.inc("d1.rows_read", observation.rowsRead)
		.inc("d1.rows_written", observation.rowsWritten)
		.inc("d1.duration_ms", observation.durationMs);
}

/**
 * Opens a database over a D1 binding, the one production uses and the one a test migrated.
 *
 * @param binding The D1 database to read and write through.
 */
export function openDatabase(binding: D1Database): Database {
	return new Database(createD1DatabaseAdapter(binding, { onStatement: recordStatement }), { now });
}

/**
 * Opens the connection every repository reads and writes through.
 *
 * @returns The isolate's database, built on the first call and reused after it.
 * @example
 * createRouter({ middleware: [database(createDatabase())] });
 */
export function createDatabase(): Database {
	return (instance ??= openDatabase(env.DB));
}
