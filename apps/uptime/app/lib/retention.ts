/**
 * Bounded retention sweeps (ADR-020). A retention job's first run after a window is
 * widened — or after a table that never had a retention job at all gets one — can match
 * millions of rows, and a single unbounded `DELETE` would then write 5–6 rows per deleted
 * row inside one queue invocation: the largest write bill and the longest statement the
 * app ever issues, both at once, with no way to stop halfway. So every sweep here runs
 * the same bounded statement in a loop instead, and stops on two conditions — the batch
 * came back short (nothing left to sweep) or the per-run batch ceiling was reached.
 *
 * Hitting the ceiling is not an error: the sweep resumes on the next scheduled run and
 * the table drains over a few nights. It is reported so the caller can log it, which is
 * the signal that a backlog is being worked through rather than kept up with.
 *
 * The bound is expressed as `id IN (SELECT id … LIMIT ?)` rather than `DELETE … LIMIT ?`.
 * Both work on the local engines this app is tested against, but `LIMIT` on `DELETE`/
 * `UPDATE` is only available when SQLite is compiled with
 * `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`, which is a property of the engine the managed
 * database happens to be built with and not something the app can assert. The subquery
 * form is valid on every SQLite build, needs the same two indexes (the date column for
 * the range, the primary key for the delete), and costs one extra index lookup per row —
 * a price worth paying to not depend on a compile-time flag in a nightly destructive job.
 *
 * Every table swept here has a single-column `id` primary key, which is what makes one
 * shared statement shape work for all of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

/**
 * Rows one batch may touch.
 *
 * Ten thousand keeps a batch's write amplification (5–6 rows written per row, across the
 * table and its indexes) inside a fraction of a Worker invocation, while still draining
 * a table of ordinary size in a handful of statements.
 */
export const RETENTION_BATCH_SIZE = 10_000;

/**
 * Batches one sweep may run before it gives up and leaves the rest for the next
 * scheduled run. At the default batch size this caps a single table at 200,000 rows per
 * run, so no one run can produce an unbounded write bill however far behind it is.
 */
export const RETENTION_MAX_BATCHES = 20;

export interface BatchedSweepOptions {
	/** Rows per batch. Defaults to {@link RETENTION_BATCH_SIZE}. */
	batchSize?: number;
	/** Batches before the sweep stops early. Defaults to {@link RETENTION_MAX_BATCHES}. */
	maxBatches?: number;
}

export interface BatchedSweepResult {
	/** Rows the sweep deleted or redacted, summed across batches. */
	rowsAffected: number;
	/** Statements the sweep executed. */
	batches: number;
	/** Whether the sweep stopped at the ceiling with work still left to do. */
	reachedCeiling: boolean;
}

/**
 * Deletes rows whose `dateColumn` is strictly older than `cutoff`, in bounded batches.
 *
 * A `NULL` in `dateColumn` never satisfies `< ?` in SQL, so a row that has not been
 * dated yet (an in-flight check, say) is never matched by a cutoff and never deleted.
 * @param db The database to sweep.
 * @param table Table to delete from; must have a single-column `id` primary key.
 * @param dateColumn Epoch-ms column the cutoff applies to.
 * @param cutoff Epoch-ms timestamp; rows strictly older than this are deleted.
 * @param options Batch size and per-run ceiling overrides.
 * @returns How many rows went, in how many batches, and whether more remain.
 * @example
 * let swept = await deleteOlderThan(db, "alert_events", "sent_at", cutoff);
 */
export async function deleteOlderThan(
	db: Database,
	table: string,
	dateColumn: string,
	cutoff: number,
	options?: BatchedSweepOptions,
): Promise<BatchedSweepResult> {
	let { batchSize, maxBatches } = resolveOptions(options);
	let name = quoteIdentifier(table);

	let sql =
		`DELETE FROM ${name} WHERE \`id\` IN (` +
		`SELECT \`id\` FROM ${name} WHERE ${quoteIdentifier(dateColumn)} < ? LIMIT ?)`;

	return await sweep(db, sql, [cutoff, batchSize], batchSize, maxBatches);
}

/**
 * Nulls `columns` on rows whose `dateColumn` is strictly older than `cutoff`, in bounded
 * batches — retention for a *field* rather than for a row, so a table can keep its rows
 * for a long window while keeping the sensitive columns on them for a short one.
 *
 * The batch only selects rows that still have a value in at least one of `columns`, which
 * is both what makes the loop terminate (a redacted row stops matching, so every batch
 * makes progress) and what makes the steady-state run cheap (only the rows that crossed
 * the cutoff since the last run match at all).
 * @param db The database to sweep.
 * @param table Table to update; must have a single-column `id` primary key.
 * @param dateColumn Epoch-ms column the cutoff applies to.
 * @param columns Nullable columns to clear. Must not be empty.
 * @param cutoff Epoch-ms timestamp; rows strictly older than this are redacted.
 * @param options Batch size and per-run ceiling overrides.
 * @returns How many rows were redacted, in how many batches, and whether more remain.
 * @example
 * let swept = await redactOlderThan(db, "cron_job_pings", "created_at", ["source_ip"], cutoff);
 */
export async function redactOlderThan(
	db: Database,
	table: string,
	dateColumn: string,
	columns: readonly string[],
	cutoff: number,
	options?: BatchedSweepOptions,
): Promise<BatchedSweepResult> {
	if (columns.length === 0) throw new RangeError("Redaction needs at least one column");

	let { batchSize, maxBatches } = resolveOptions(options);
	let name = quoteIdentifier(table);
	let quoted = columns.map((column) => quoteIdentifier(column));

	let sql =
		`UPDATE ${name} SET ${quoted.map((column) => `${column} = NULL`).join(", ")} ` +
		`WHERE \`id\` IN (SELECT \`id\` FROM ${name} WHERE ${quoteIdentifier(dateColumn)} < ? ` +
		`AND (${quoted.map((column) => `${column} IS NOT NULL`).join(" OR ")}) LIMIT ?)`;

	return await sweep(db, sql, [cutoff, batchSize], batchSize, maxBatches);
}

/**
 * Runs one bounded statement until it comes back short or the ceiling is reached.
 *
 * A short batch means the statement's own `LIMIT` was not filled, so nothing is left to
 * match — one statement cheaper than looping until a batch affects zero rows, and the
 * same stopping condition. The loop is sequential on purpose: each batch's result is what
 * decides whether another batch runs at all, and the batches contend for the same rows,
 * so running them concurrently would both break the stopping condition and multiply the
 * peak write rate this whole module exists to bound.
 */
async function sweep(
	db: Database,
	sql: string,
	values: unknown[],
	batchSize: number,
	maxBatches: number,
): Promise<BatchedSweepResult> {
	let rowsAffected = 0;
	let batches = 0;

	while (batches < maxBatches) {
		let result = await db.exec(sql, values);
		batches += 1;

		let affected = result.affectedRows ?? 0;
		rowsAffected += affected;

		if (affected < batchSize) return { rowsAffected, batches, reachedCeiling: false };
	}

	return { rowsAffected, batches, reachedCeiling: true };
}

/** Resolves and range-checks the batch size and ceiling for one sweep. */
function resolveOptions(options?: BatchedSweepOptions): { batchSize: number; maxBatches: number } {
	let batchSize = options?.batchSize ?? RETENTION_BATCH_SIZE;
	let maxBatches = options?.maxBatches ?? RETENTION_MAX_BATCHES;

	if (!Number.isInteger(batchSize) || batchSize < 1) {
		throw new RangeError(`Batch size must be a positive integer, got ${batchSize}`);
	}

	if (!Number.isInteger(maxBatches) || maxBatches < 1) {
		throw new RangeError(`Batch ceiling must be a positive integer, got ${maxBatches}`);
	}

	return { batchSize, maxBatches };
}

/**
 * Quotes a table or column name for interpolation into a statement.
 *
 * Callers pass literals from this app's own schema, never anything a request supplied,
 * but a destructive statement is the wrong place to rely on that: an identifier that
 * isn't a plain lowercase snake_case name is rejected outright rather than quoted and
 * hoped for.
 */
function quoteIdentifier(name: string): string {
	if (!/^[a-z][a-z0-9_]*$/.test(name)) {
		throw new RangeError(`Not a valid table or column identifier: ${name}`);
	}

	return `\`${name}\``;
}
