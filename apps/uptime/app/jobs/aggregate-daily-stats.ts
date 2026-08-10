/**
 * Daily background job that rolls up the previous UTC day's checks into one
 * `monitor_daily_stats` row per monitor — the source for the uptime bars and
 * long-term reporting (`docs/analytics.md`). HTTP aggregates come from Analytics
 * Engine, since that's the only store HTTP results land in; DNS, TCP, and cron-job
 * aggregates come from their own D1 result tables. All four monitor types are
 * aggregated uniformly here.
 *
 * Rows are written in bounded-concurrency batches rather than one at a time, matching the
 * monitor sweeps (ADR-008). One monitor's failed write is logged and counted instead of
 * abandoning the rest of the roll-up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import MonitorDailyStats, {
	calculateDailyStatus,
	getYesterdayDateUtc,
	utcDayBounds,
	type DailyStatsInput,
} from "~/app/data/monitor-daily-stats";
import Team from "~/app/data/team";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { getHttpDailyAggregate } from "~/app/services/analytics";
import { apportionCost } from "~/app/services/cost";

interface RawAggregateRow {
	monitorId: string;
	totalChecks: number;
	successfulChecks: number;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
}

export class AggregateDailyStatsJob extends Job {
	/** The "Daily Stats Aggregation" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "3f5a0689-1ced-4fcc-826d-3c1dc3c2795e";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let date = getYesterdayDateUtc();

		/**
		 * The roll-up's cost is split by monitors per team (ADR-007 §5): it writes one row
		 * per monitor, and the four aggregate queries it writes them from cannot be
		 * attributed any other way.
		 */
		apportionCost(await Team.countMonitorsByTeam(db));

		let written = 0;
		written += await this.aggregateHttp(db, date);
		written += await this.aggregateD1(
			db,
			date,
			"dns",
			"dns_monitor_results",
			"dns_monitor_id",
			"ok",
		);
		written += await this.aggregateD1(
			db,
			date,
			"tcp",
			"tcp_monitor_results",
			"tcp_monitor_id",
			"up",
		);
		written += await this.aggregateCron(db, date);

		this.logger.info("job.aggregate_daily_stats.completed", { date, written });
	}

	private async aggregateHttp(db: Database, date: string): Promise<number> {
		let result = await getHttpDailyAggregate(date);
		if (isFailure(result)) {
			this.logger.error("job.aggregate_daily_stats.http_failed", {
				date,
				error: result.error.message,
			});
			return 0;
		}

		return await this.writeAll(
			db,
			result.data.map((row) => ({
				monitor_id: row.monitorId,
				monitor_type: "http",
				date,
				total_checks: Math.round(row.totalChecks),
				successful_checks: Math.round(row.successfulChecks),
				avg_response_time_ms:
					row.avgResponseTimeMs === null ? null : Math.round(row.avgResponseTimeMs),
				max_response_time_ms:
					row.maxResponseTimeMs === null ? null : Math.round(row.maxResponseTimeMs),
			})),
		);
	}

	/** Aggregates a D1 result table whose rows carry a `status` and `response_time_ms`. */
	private async aggregateD1(
		db: Database,
		date: string,
		monitorType: "dns" | "tcp",
		table: string,
		monitorIdColumn: string,
		healthyStatus: string,
	): Promise<number> {
		let { start, end } = utcDayBounds(date);

		let result = await db.exec(
			`SELECT
				${monitorIdColumn} AS monitorId,
				COUNT(*) AS totalChecks,
				SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS successfulChecks,
				AVG(response_time_ms) AS avgResponseTimeMs,
				MAX(response_time_ms) AS maxResponseTimeMs
			 FROM ${table}
			 WHERE checked_at >= ? AND checked_at < ?
			 GROUP BY ${monitorIdColumn}`,
			[healthyStatus, start, end],
		);

		let rows = (result.rows ?? []) as unknown as RawAggregateRow[];

		return await this.writeAll(
			db,
			rows.map((row) => ({
				monitor_id: row.monitorId,
				monitor_type: monitorType,
				date,
				total_checks: row.totalChecks,
				successful_checks: row.successfulChecks,
				avg_response_time_ms:
					row.avgResponseTimeMs === null ? null : Math.round(row.avgResponseTimeMs),
				max_response_time_ms:
					row.maxResponseTimeMs === null ? null : Math.round(row.maxResponseTimeMs),
			})),
		);
	}

	/** Cron-job pings have no response time; "successful" means the ping was on time. */
	private async aggregateCron(db: Database, date: string): Promise<number> {
		let { start, end } = utcDayBounds(date);

		let result = await db.exec(
			`SELECT
				cron_job_monitor_id AS monitorId,
				COUNT(*) AS totalChecks,
				SUM(CASE WHEN was_on_time = 1 THEN 1 ELSE 0 END) AS successfulChecks
			 FROM cron_job_pings
			 WHERE created_at >= ? AND created_at < ?
			 GROUP BY cron_job_monitor_id`,
			[start, end],
		);

		let rows = (result.rows ?? []) as unknown as Array<{
			monitorId: string;
			totalChecks: number;
			successfulChecks: number;
		}>;

		return await this.writeAll(
			db,
			rows.map((row) => ({
				monitor_id: row.monitorId,
				monitor_type: "cron",
				date,
				total_checks: row.totalChecks,
				successful_checks: row.successfulChecks,
				avg_response_time_ms: null,
				max_response_time_ms: null,
			})),
		);
	}

	/**
	 * Writes every row in bounded-concurrency batches, returning how many landed. A single
	 * row's failure is logged and skipped rather than aborting the day's roll-up, so one
	 * bad monitor can't cost every monitor behind it its daily stats.
	 */
	private async writeAll(
		db: Database,
		inputs: Array<Omit<DailyStatsInput, "failed_checks" | "status">>,
	): Promise<number> {
		let settled = await mapWithConcurrency(inputs, (input) => this.write(db, input));
		let written = 0;

		for (let outcome of settled) {
			if (outcome.ok) {
				written++;
				continue;
			}

			this.logger.error("job.aggregate_daily_stats.write_failed", {
				monitorId: outcome.item.monitor_id,
				monitorType: outcome.item.monitor_type,
				date: outcome.item.date,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		return written;
	}

	private async write(
		db: Database,
		input: Omit<DailyStatsInput, "failed_checks" | "status">,
	): Promise<void> {
		await MonitorDailyStats.upsertDay(db, {
			...input,
			failed_checks: input.total_checks - input.successful_checks,
			status: calculateDailyStatus(input.successful_checks, input.total_checks),
		});
	}
}
