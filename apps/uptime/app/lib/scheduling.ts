/**
 * The `next_due_at` scheduling rules every monitor type shares: the atomic claim each
 * sweep runs to take the monitors whose next check is owed, and the two writes that keep
 * the column consistent when a monitor is created or edited.
 *
 * `monitors`, `tcp_monitors` and `dns_monitors` share this column and its meaning —
 * `NULL` means unscheduled, any other value is when the next check is due — and all
 * three advance it by whole `interval_seconds`. The arithmetic, the claim's guard, and
 * the create/edit rules live here once instead of once per table, so a change to how
 * scheduling works is one edit instead of three that can drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, Database, TableColumnName, TableRow } from "remix/data-table";

import { getTableName } from "remix/data-table";

/**
 * The scheduling-relevant half of an edit. Each monitor table spells "enabled" its own
 * way (`enabled_at` timestamp vs. `is_enabled` boolean), so callers reduce their own
 * column to these two facts and the rule stays single. `undefined` leaves a field as is.
 */
interface ScheduleEdit {
	enabled?: boolean;
	intervalSeconds?: number;
}

/**
 * When a newly scheduled monitor becomes due: immediately, so its first status lands
 * on the very next tick. Returns `null` for an unscheduled monitor, which the claim's
 * guard reads as "skip me".
 */
export function nextDueAtOnEnable(enabled: boolean): number | null {
	return enabled ? Date.now() : null;
}

/**
 * Claims every row of `table` whose next check is due as of `scheduledAt`, in one
 * atomic `UPDATE … RETURNING` that advances each row's next due time by whole
 * intervals, so concurrent deliveries can never claim the same monitor twice.
 * @param db Database to run the claim against.
 * @param table Table to claim from; must carry `next_due_at` and `interval_seconds`.
 * @param columns Columns of each claimed row to return.
 * @param scheduledAt The instant "due" is measured against; advances land strictly
 * past this value.
 * @returns `columns` for every row the claim moved.
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
 * The `next_due_at` change an edit implies, as a patch to merge into the update. An
 * interval-only edit reads the stored row, since an unscheduled monitor stays
 * unscheduled and a resubmitted-but-unchanged interval leaves the cadence as is.
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
	if (row.nextDueAt === null) return {};

	return { next_due_at: Date.now() };
}
