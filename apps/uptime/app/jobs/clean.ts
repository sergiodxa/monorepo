/**
 * Scheduled maintenance job that applies a per-table retention window to everything that
 * grows with monitor activity (ADR-020), batched in one job so the schedule and log line
 * stay shared. A row whose date column is still `NULL` is never matched by a cutoff. The
 * free-watch tables are the exception: their three sweeps run in a load-bearing order —
 * see {@link sweepTrial}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createJobHandler } from "@pkg/jobs-next";

import type { BatchedSweepResult } from "~/app/lib/retention";

import Lead from "~/app/data/lead";
import Team from "~/app/data/team";
import TrialWatch from "~/app/data/trial-watch";
import jobs from "~/app/jobs";
import { deleteOlderThan } from "~/app/lib/retention";
import { apportionCost } from "~/app/services/cost";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retention windows, in days, one named constant per table so each is tunable without
 * touching SQL. Widening one is safe; narrowing one deletes history that cannot be
 * recovered, so each number stays generous relative to what the app reads back.
 */
const MONITOR_RESULT_RETENTION_DAYS = 7;
const DNS_RESULT_RETENTION_DAYS = 90;
const TCP_RESULT_RETENTION_DAYS = 90;
/**
 * Longer than the HTTP window and the same as the other two, which the volume permits: the
 * finest flow interval is fifteen minutes (ADR-027 §7a), so a flow monitor writes at most
 * 2,688 rows a month against an HTTP monitor's 40,320.
 */
const FLOW_RESULT_RETENTION_DAYS = 90;
const ALERT_EVENT_RETENTION_DAYS = 90;

interface RetainedTable {
	table: string;
	/**
	 * The epoch-ms column the window applies to. Each table dates its rows differently —
	 * HTTP results by when the check finished, DNS/TCP by when it ran, alerts by when the
	 * notification went out — matching the column it declares in `database/schema.ts`.
	 */
	dateColumn: string;
	retentionDays: number;
}

const RETAINED_TABLES: readonly RetainedTable[] = [
	{
		table: "monitor_results",
		dateColumn: "completed_at",
		retentionDays: MONITOR_RESULT_RETENTION_DAYS,
	},
	{
		table: "dns_monitor_results",
		dateColumn: "checked_at",
		retentionDays: DNS_RESULT_RETENTION_DAYS,
	},
	{
		table: "tcp_monitor_results",
		dateColumn: "checked_at",
		retentionDays: TCP_RESULT_RETENTION_DAYS,
	},
	{
		table: "flow_monitor_results",
		dateColumn: "checked_at",
		retentionDays: FLOW_RESULT_RETENTION_DAYS,
	},
	{ table: "alert_events", dateColumn: "sent_at", retentionDays: ALERT_EVENT_RETENTION_DAYS },
];

/** One table's line in the completion log. */
interface SweptTable {
	table: string;
	rowsDeleted: number;
	batches: number;
	reachedCeiling: boolean;
}

export default createJobHandler(jobs.clean, async (ctx) => {
	let now = Date.now();

	/**
	 * Charged when the delete happens, split by monitors per team (ADR-007 §5): a bulk
	 * `DELETE` cannot say whose rows it removed, so monitor count is the closest proxy
	 * for the volume each team contributed.
	 */
	apportionCost(await Team.countMonitorsByTeam(ctx.database));

	let tables: SweptTable[] = [];

	/**
	 * One table at a time, and one batch at a time inside each: the point of the
	 * batching is to bound how much this job writes at once, which running the tables
	 * concurrently would immediately undo.
	 */
	for (let entry of RETAINED_TABLES) {
		let cutoff = now - entry.retentionDays * MS_PER_DAY;
		let swept = await deleteOlderThan(ctx.database, entry.table, entry.dateColumn, cutoff);
		tables.push(record(entry.table, swept));
	}

	tables.push(...(await sweepTrial(ctx.database, now)));

	let rowsDeleted = tables.reduce((total, entry) => total + entry.rowsDeleted, 0);
	/**
	 * `reachedCeiling` is the field to watch after a window changes: it means a table
	 * still has rows past its cutoff and the next run will continue draining it.
	 */
	let reachedCeiling = tables.some((entry) => entry.reachedCeiling);

	ctx.logger.info("job.clean.completed", { rowsDeleted, reachedCeiling, tables });
});

/**
 * Sweeps free-watch tables in the only correct order: results before the watch that
 * identifies them, then watches past their `converts_until`, then leads with no watch
 * left — each step's own condition only holds once the step before it has already run.
 */
async function sweepTrial(db: Database, now: number): Promise<SweptTable[]> {
	let results = await TrialWatch.deleteExpiredResults(db, now);
	let watches = await TrialWatch.deleteExpired(db, now);
	let leads = await Lead.deleteOrphaned(db, now);

	return [
		record("trial_watch_results", results),
		record("trial_watches", watches),
		record("leads", leads),
	];
}

/** One sweep's outcome as the completion log reports it. */
function record(table: string, swept: BatchedSweepResult): SweptTable {
	return {
		table,
		rowsDeleted: swept.rowsAffected,
		batches: swept.batches,
		reachedCeiling: swept.reachedCeiling,
	};
}
