/**
 * Per-unit-of-work accumulator for the D1 row counts the database adapter reports
 * (ADR-019). Every D1 response already carries `meta.rows_read`/`meta.rows_written`;
 * `@pkg/data-table-d1`'s `onStatement` observer hands them over instead of discarding
 * them, and this module attributes them to whichever job or request was running when
 * the statement executed.
 *
 * The accumulator is async-local rather than module-global on purpose: the queue
 * handler starts every message in a batch inside one container scope and runs them
 * concurrently, so a shared counter would pool a whole batch's cost into one number
 * and answer none of the questions worth asking. Statements executed outside a
 * tracked unit of work — migrations, boot-time probes — are simply not counted rather
 * than being charged to whichever job happened to be running.
 *
 * What this buys, per ADR-002 §16, is the breakdown Cloudflare's analytics cannot
 * give: `d1AnalyticsAdaptiveGroups` reports rows read per *database*, while a cost
 * regression has to be traced to the *query* that caused it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { D1StatementObservation } from "@pkg/data-table-d1";
import type { Job } from "@pkg/jobs";

/**
 * The unit of work currently being measured, if any. Holds the same mutable counter
 * object the caller will read afterwards, so recording is a few additions with no
 * allocation and no lookup beyond the async-local store.
 */
const storage = new AsyncLocalStorage<Job.Usage>();

/** A fresh, zeroed set of counters. */
export function createD1Usage(): Job.Usage {
	return { statements: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0 };
}

/**
 * Adds one statement's cost to the active accumulator, or does nothing when no unit
 * of work is being measured.
 *
 * This is the adapter's `onStatement` observer, so it runs once per statement on the
 * hot path: it allocates nothing, does no I/O, and cannot throw.
 * @param observation The row counts D1 reported for one statement.
 */
export function recordD1Statement(observation: D1StatementObservation): void {
	let usage = storage.getStore();
	if (!usage) return;

	usage.statements += 1;
	usage.rowsRead += observation.rowsRead;
	usage.rowsWritten += observation.rowsWritten;
	usage.durationMs += observation.durationMs;
}

/**
 * Runs `body` with `usage` as the active accumulator, so every statement it issues is
 * attributed to it and not to a concurrently running sibling.
 *
 * This is the shape `@pkg/jobs`' `setJobUsageTracker` expects, and the same function
 * a request path can wrap a handler in to get the totals for one request.
 * @param usage Counters to accumulate into, from {@link createD1Usage}.
 * @param body The unit of work to measure.
 * @returns Whatever `body` returns.
 */
export function trackD1Usage<T>(usage: Job.Usage, body: () => Promise<T>): Promise<T> {
	return storage.run(usage, body);
}
