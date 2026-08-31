/**
 * Daily background job that rolls up the previous UTC day's checks into one
 * `monitor_daily_stats` row per monitor, the source for the uptime bars and
 * long-term reporting. HTTP aggregates come from Analytics Engine, since that's
 * the only store HTTP results land in; DNS, TCP, flow, and cron-job aggregates
 * come from their own D1 result tables.
 *
 * Rows are written in bounded-concurrency batches, matching the monitor sweeps
 * (ADR-008); one monitor's failed write is logged and counted instead of
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

/** One D1 result table, and how a day of its rows becomes a `monitor_daily_stats` row. */
interface D1Source {
	monitorType: "dns" | "tcp" | "flow";
	table: string;
	monitorIdColumn: string;
	/** The status a passing check is stored as; every other one counts against uptime. */
	healthyStatus: string;
	/** Where the check's duration lives, when the table spells it something else. */
	responseTimeColumn?: string;
	/**
	 * The status of a check that never got to run. Those rows are dropped from the day
	 * outright, so they neither pass nor fail, and a monitor whose whole day was
	 * inconclusive gets no row rather than one reading as an outage.
	 */
	inconclusiveStatus?: string;
}

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
		 * per monitor, and the aggregate queries it writes them from cannot be attributed
		 * any other way.
		 */
		apportionCost(await Team.countMonitorsByTeam(db));

		let written = 0;
		written += await this.aggregateHttp(db, date);
		written += await this.aggregateD1(db, date, {
			monitorType: "dns",
			table: "dns_monitor_results",
			monitorIdColumn: "dns_monitor_id",
			healthyStatus: "ok",
		});
		written += await this.aggregateD1(db, date, {
			monitorType: "tcp",
			table: "tcp_monitor_results",
			monitorIdColumn: "tcp_monitor_id",
			healthyStatus: "up",
		});
		written += await this.aggregateD1(db, date, {
			monitorType: "flow",
			table: "flow_monitor_results",
			monitorIdColumn: "flow_monitor_id",
			healthyStatus: "up",
			/**
			 * A flow's latency series is the run's wall clock, the same number its detail page
			 * averages, so the digest and the page quote one figure (ADR-027).
			 */
			responseTimeColumn: "duration_ms",
			/**
			 * An `error` run is this app failing to find out, not the flow being broken, so it
			 * counts in neither half of the day's rate — the split the detail page's pass rate
			 * already draws (ADR-027 §8). A day of nothing but errors therefore writes no row
			 * at all, leaving a gap in the bar rather than reporting a customer's flow down for
			 * a reason that is ours.
			 */
			inconclusiveStatus: "error",
		});
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

	/** Aggregates a D1 result table whose rows carry a `status` and a duration. */
	private async aggregateD1(db: Database, date: string, source: D1Source): Promise<number> {
		let { start, end } = utcDayBounds(date);
		let responseTimeColumn = source.responseTimeColumn ?? "response_time_ms";
		let values: Array<string | number> = [source.healthyStatus, start, end];
		let conclusiveOnly = "";

		if (source.inconclusiveStatus !== undefined) {
			conclusiveOnly = "AND status <> ?";
			values.push(source.inconclusiveStatus);
		}

		let result = await db.exec(
			`SELECT
				${source.monitorIdColumn} AS monitorId,
				COUNT(*) AS totalChecks,
				SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS successfulChecks,
				AVG(${responseTimeColumn}) AS avgResponseTimeMs,
				MAX(${responseTimeColumn}) AS maxResponseTimeMs
			 FROM ${source.table}
			 WHERE checked_at >= ? AND checked_at < ? ${conclusiveOnly}
			 GROUP BY ${source.monitorIdColumn}`,
			values,
		);

		let rows = (result.rows ?? []) as unknown as RawAggregateRow[];

		return await this.writeAll(
			db,
			rows.map((row) => ({
				monitor_id: row.monitorId,
				monitor_type: source.monitorType,
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
