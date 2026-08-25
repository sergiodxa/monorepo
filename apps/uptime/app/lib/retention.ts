/**
 * Bounded retention sweeps (ADR-020). An unbounded `DELETE` on a first run, or on a
 * table that never had a retention job, can match millions of rows in one blocking
 * statement — the largest write bill and the longest statement the app issues. Every
 * sweep here instead runs the same bounded statement in a loop, stopping when a batch
 * comes back short or the per-run ceiling is reached.
 *
 * Hitting the ceiling is a normal outcome: the sweep resumes on the next scheduled
 * run, and reporting it lets the caller log a backlog being worked down over nights.
 *
 * The bound is a subquery, which works uniformly across every SQLite build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

/**
 * Rows one batch may touch. Ten thousand keeps a batch's write amplification (5–6 rows
 * written per row, across the table and its indexes) inside a fraction of a Worker
 * invocation, while still draining an ordinary table in a handful of statements.
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
 * Nulls `columns` on rows whose `dateColumn` is strictly older than `cutoff`, keeping
 * the row itself. Each batch selects only rows still holding a value in one of
 * `columns`, which both ends the loop and keeps a steady-state run cheap.
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
 * Runs one bounded statement until it comes back short or the ceiling is reached. The
 * loop stays sequential: each batch's result decides whether another runs, and
 * concurrent batches would multiply the peak write rate this module bounds.
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
 * Quotes a table or column name for interpolation into a statement. Since this guards
 * a destructive statement, an identifier must match a plain lowercase snake_case name
 * to be quoted at all — everything else is rejected outright.
 */
function quoteIdentifier(name: string): string {
	if (!/^[a-z][a-z0-9_]*$/.test(name)) {
		throw new RangeError(`Not a valid table or column identifier: ${name}`);
	}

	return `\`${name}\``;
}
