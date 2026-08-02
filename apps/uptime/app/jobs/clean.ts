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
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Team from "~/app/data/team";
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

		let rowsDeleted = 0;
		let reachedCeiling = false;
		let tables: Array<{
			table: string;
			rowsDeleted: number;
			batches: number;
			reachedCeiling: boolean;
		}> = [];

		/**
		 * One table at a time, and one batch at a time inside each: the point of the
		 * batching is to bound how much this job writes at once, which running the tables
		 * concurrently would immediately undo.
		 */
		for (let entry of RETAINED_TABLES) {
			let cutoff = now - entry.retentionDays * MS_PER_DAY;
			let swept = await deleteOlderThan(db, entry.table, entry.dateColumn, cutoff);

			rowsDeleted += swept.rowsAffected;
			reachedCeiling = reachedCeiling || swept.reachedCeiling;

			tables.push({
				table: entry.table,
				rowsDeleted: swept.rowsAffected,
				batches: swept.batches,
				reachedCeiling: swept.reachedCeiling,
			});
		}

		/**
		 * `reachedCeiling` is the field to watch after a window changes: it means a table
		 * still has rows past its cutoff and the next run will continue draining it.
		 */
		this.logger.info("job.clean.completed", { rowsDeleted, reachedCeiling, tables });
	}
}
