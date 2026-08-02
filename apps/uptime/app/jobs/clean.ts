/**
 * Scheduled maintenance job that applies a retention window to every table that grows
 * with monitor activity (ADR-020). One job rather than one per table: they all run on the
 * same daily schedule and the work is a handful of bounded `DELETE`s, so a shared job
 * keeps the schedule, the log line, and the batching in one place.
 *
 * The windows differ by what the table is for. `monitor_results` holds the record of the
 * last day or two of checks that `Monitor.countConsumedPingsByTeam` counts before the
 * daily rollup reaches them — long-term HTTP analytics and history live in Analytics
 * Engine — so a week is already far longer than anything reads. Scheduling no longer
 * reads this table at all: ADR-003 moved that onto `monitors.next_due_at`, which is what
 * makes the table's retention a question of counting alone. The DNS, TCP, and alert
 * tables *are* the history a monitor detail page and an incident post-mortem read, so they
 * keep a quarter: long enough to be useful, short enough that their steady-state size is a
 * function of write rate rather than of account age.
 *
 * A row whose date column is still `NULL` (an in-flight or pending check) is never matched
 * by a cutoff and is left alone.
 *
 * The free-watch tables are swept too, and they are the one part of this job that is not a
 * plain per-table window: their three sweeps are ordered and the order is load-bearing. See
 * {@link CleanJob.sweepTrial}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/lib/retention";

import Lead from "~/app/data/lead";
import Team from "~/app/data/team";
import TrialWatch from "~/app/data/trial-watch";
import { deleteOlderThan } from "~/app/lib/retention";
import { apportionCost } from "~/app/services/cost";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retention windows, in days, one named constant per table so each is tunable on its own
 * without reading any SQL. Widening one of these is safe; narrowing one deletes history
 * that cannot be recovered, so the numbers are deliberately generous relative to what the
 * app actually reads back.
 */
const MONITOR_RESULT_RETENTION_DAYS = 7;
const DNS_RESULT_RETENTION_DAYS = 90;
const TCP_RESULT_RETENTION_DAYS = 90;
const ALERT_EVENT_RETENTION_DAYS = 90;

interface RetainedTable {
	/** Table to sweep. */
	table: string;
	/**
	 * The epoch-ms column the window applies to. Each table dates its rows from a
	 * different column — HTTP results from when the check finished, DNS and TCP results
	 * from when the check ran, alert events from when the notification went out — and each
	 * one below is the column that table declares in `database/schema.ts`, not a guess.
	 */
	dateColumn: string;
	/** Days of rows to keep. */
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
	{ table: "alert_events", dateColumn: "sent_at", retentionDays: ALERT_EVENT_RETENTION_DAYS },
];

/** One table's line in the completion log. */
interface SweptTable {
	table: string;
	rowsDeleted: number;
	batches: number;
	reachedCeiling: boolean;
}

export class CleanJob extends Job {
	/** The "Clean Old Monitor Results" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "80294988-476e-4e99-9f5c-abfeb369316a";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let now = Date.now();

		/**
		 * Retention is charged when it happens, split by monitors per team (ADR-007 §5).
		 * Prepaying it at insert instead — charging each result row for the delete it will
		 * later cause — would double-count against these `DELETE`s, which the statement
		 * observer measures for real; and a single bulk `DELETE` cannot say whose rows it
		 * removed, so monitor count is the closest available proxy for the volume each team
		 * put in.
		 */
		apportionCost(await Team.countMonitorsByTeam(db));

		let tables: SweptTable[] = [];

		/**
		 * One table at a time, and one batch at a time inside each: the point of the
		 * batching is to bound how much this job writes at once, which running the tables
		 * concurrently would immediately undo.
		 */
		for (let entry of RETAINED_TABLES) {
			let cutoff = now - entry.retentionDays * MS_PER_DAY;
			let swept = await deleteOlderThan(db, entry.table, entry.dateColumn, cutoff);
			tables.push(record(entry.table, swept));
		}

		tables.push(...(await this.sweepTrial(db, now)));

		let rowsDeleted = tables.reduce((total, entry) => total + entry.rowsDeleted, 0);
		/**
		 * `reachedCeiling` is the field to watch after a window changes: it means a table
		 * still has rows past its cutoff and the next run will continue draining it.
		 */
		let reachedCeiling = tables.some((entry) => entry.reachedCeiling);

		this.logger.info("job.clean.completed", { rowsDeleted, reachedCeiling, tables });
	}

	/**
	 * Sweeps the three free-watch tables, in the only order that is correct.
	 *
	 * Each sweep's own condition is only sound once the one before it has run, so this is a
	 * sequence and not a list of independent windows:
	 *
	 * 1. **Results** go with the watch they belong to, found by joining to it, so they must be
	 *    swept while it still exists — the watch row is the only thing that identifies them,
	 *    and taking it first would strand every one of them permanently. They carry no age of
	 *    their own: a shorter one would leave a watch that is still being reported on with
	 *    nothing to report, and one as long as the watch's would delete them days after it.
	 * 2. **Watches** go on `converts_until`, thirty days, and never on `expires_at`: a watch
	 *    whose week of checking ended is still claimable as a real monitor for another three,
	 *    and sweeping the wrong column would withdraw the offer without anyone noticing. Step
	 *    1 has already taken everything that pointed at it, so nothing is orphaned.
	 * 3. **Leads** go only when no watch is left to protect, which is the right condition
	 *    *because* step 2 has already reduced their watches to the ones still worth keeping.
	 *    Run before it, and someone who tried three URLs on three days would be deleted while
	 *    two of their attempts were still convertible.
	 */
	private async sweepTrial(db: Database, now: number): Promise<SweptTable[]> {
		let results = await TrialWatch.deleteExpiredResults(db, now);
		let watches = await TrialWatch.deleteExpired(db, now);
		let leads = await Lead.deleteOrphaned(db, now);

		return [
			record("trial_watch_results", results),
			record("trial_watches", watches),
			record("leads", leads),
		];
	}
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
