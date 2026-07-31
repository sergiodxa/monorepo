/**
 * The `next_due_at` scheduling rules every monitor type shares: the atomic claim each
 * sweep runs to take the monitors whose next check is owed, and the two writes that keep
 * the column consistent when a monitor is created or edited.
 *
 * `monitors`, `tcp_monitors` and `dns_monitors` all carry the same column with the same
 * meaning — `NULL` is "not scheduled" (disabled, or never enabled), any other value is
 * when the next check is due — and all three advance it by whole `interval_seconds`. The
 * arithmetic, the claim's guard, and the create/edit rules therefore live here once
 * instead of once per table: a change to how scheduling works is one edit, not three that
 * can drift. Only the table and the columns a caller needs back from a claim differ, and
 * both are parameters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, Database, TableColumnName, TableRow } from "remix/data-table";

import { getTableName } from "remix/data-table";

/**
 * The scheduling-relevant half of an edit. Each monitor table spells "enabled" its own way
 * (`monitors.enabled_at` is a nullable timestamp, `tcp_monitors`/`dns_monitors` use a
 * boolean `is_enabled`), so callers reduce their own column to these two facts and the rule
 * below stays single. `undefined` means "the edit doesn't touch this".
 */
interface ScheduleEdit {
	enabled?: boolean;
	intervalSeconds?: number;
}

/**
 * When a monitor that has just been scheduled becomes due: immediately, so it reports a
 * status on the next tick rather than after one silent interval. `null` for a monitor that
 * isn't scheduled at all, which is what the claim's guard reads as "skip me".
 */
export function nextDueAtOnEnable(enabled: boolean): number | null {
	return enabled ? Date.now() : null;
}

/**
 * Claims every row of `table` whose next check is due as of `scheduledAt`, having already
 * advanced each one's next due time, and returns `columns` of the rows it moved.
 *
 * "Due" is `next_due_at IS NOT NULL AND next_due_at <= scheduledAt`, which is the whole
 * predicate: `next_due_at` is NULL exactly when a monitor isn't scheduled, so it subsumes
 * the per-table enabled check and one index on `next_due_at` serves the query.
 *
 * The due time advances **from its own previous value**, by whole intervals until strictly
 * past `scheduledAt`:
 *
 * ```text
 * next = previous_next_due_at
 * while next <= scheduledAt: next += interval_seconds * 1000
 * ```
 *
 * which the UPDATE below writes in closed form as `previous + interval *
 * (⌊(scheduledAt - previous) / interval⌋ + 1)` — SQLite's `/` is integer division and both
 * operands are non-negative, so it floors. Advancing by whole intervals keeps the cadence
 * anchored to the schedule instead of to completion times, so a check's own latency can't
 * push the next one out; stopping at the first value past `scheduledAt` prevents a catch-up
 * storm, so a monitor left unscheduled for an hour gets one check, not sixty.
 *
 * One statement, not a read followed by a write. That distinction is the whole point:
 * `RETURNING` reports the rows this `UPDATE` actually moved, so two deliveries racing in
 * the same instant cannot both come away with the same monitor — the loser's `next_due_at
 * <= ?` guard no longer matches and it claims nothing. A read-then-write pair would hand
 * both deliveries the same rows and enqueue the work twice. This is also what makes running
 * the every-minute cron more often than a monitor's interval free: in most minutes the
 * indexed range matches nothing at all.
 *
 * `columns` is projected rather than `*` because `RETURNING` yields raw stored values, so
 * only the columns a caller actually reads should cross this boundary. Values arrive as D1
 * holds them: text, integers and NULLs pass through faithfully, but a boolean column would
 * come back as 0/1 despite its declared type, so those belong in a follow-up read rather
 * than here.
 */
export async function claimDue<table extends AnyTable, column extends TableColumnName<table>>(
	db: Database,
	table: table,
	columns: readonly column[],
	scheduledAt: number,
): Promise<Pick<TableRow<table>, column>[]> {
	let claimed = await db.exec(
		`UPDATE ${getTableName(table)}
		    SET next_due_at = next_due_at
		          + (interval_seconds * 1000)
		          * (((? - next_due_at) / (interval_seconds * 1000)) + 1),
		        updated_at = ?
		  WHERE next_due_at IS NOT NULL
		    AND next_due_at <= ?
		RETURNING ${columns.join(", ")}`,
		[scheduledAt, Date.now(), scheduledAt],
	);

	return (claimed.rows ?? []) as unknown as Pick<TableRow<table>, column>[];
}

/**
 * The `next_due_at` change an edit implies, as a patch to merge into the update — an empty
 * patch when the edit can't have changed the schedule and the column must be left where the
 * claim put it.
 *
 * A patch rather than a value because "leave it alone", "unschedule it" and "make it due
 * now" are three different outcomes, and only two of them are values: an absent key says
 * don't write the column at all.
 *
 * An enable/disable in the edit settles it without reading anything. An interval change on
 * its own is the only case that has to look at the stored row, for two reasons — an
 * unscheduled monitor must stay unscheduled, and the web forms resubmit `interval_seconds`
 * on every edit, so re-anchoring the cadence unconditionally would restart it every time a
 * monitor is renamed.
 */
export async function nextDueAtPatch(
	db: Database,
	table: AnyTable,
	id: string,
	edit: ScheduleEdit,
): Promise<{ next_due_at?: number | null }> {
	if (edit.enabled !== undefined) return { next_due_at: nextDueAtOnEnable(edit.enabled) };
	if (edit.intervalSeconds === undefined) return {};

	let stored = await db.exec(
		`SELECT interval_seconds AS intervalSeconds, next_due_at AS nextDueAt
		   FROM ${getTableName(table)}
		  WHERE id = ?`,
		[id],
	);

	let [row] = (stored.rows ?? []) as unknown as {
		intervalSeconds: number;
		nextDueAt: number | null;
	}[];

	if (!row) return {};
	if (row.intervalSeconds === edit.intervalSeconds) return {};
	// Already unscheduled, so a new interval doesn't schedule it — only enabling does.
	if (row.nextDueAt === null) return {};

	// A genuinely new interval re-anchors the cadence to now, so the shorter of the two
	// takes effect on the next tick rather than at the old interval's next boundary.
	return { next_due_at: Date.now() };
}
