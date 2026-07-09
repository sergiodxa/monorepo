/**
 * Daily background job that rolls up the previous UTC day's checks into one
 * `monitor_daily_stats` row per monitor — the source for the 365-day heatmap and
 * long-term reporting (`docs/analytics.md`). HTTP aggregates come from Analytics
 * Engine, since that's the only store HTTP results land in; DNS, TCP, and cron-job
 * aggregates come from their own D1 result tables. The OLD APP only ever aggregated
 * HTTP and TCP (and its TCP aggregates were moot — its TCP checks always reported
 * "unsupported", per ADR-001 Phase 3), and never wired up DNS or cron-job despite the
 * table anticipating them; this job covers all four uniformly.
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
import { getHttpDailyAggregate } from "~/app/services/analytics";

interface RawAggregateRow {
	monitorId: string;
	totalChecks: number;
	successfulChecks: number;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
}

export class AggregateDailyStatsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let date = getYesterdayDateUtc();

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

		for (let row of result.data) {
			await this.write(db, {
				monitor_id: row.monitorId,
				monitor_type: "http",
				date,
				total_checks: Math.round(row.totalChecks),
				successful_checks: Math.round(row.successfulChecks),
				avg_response_time_ms:
					row.avgResponseTimeMs === null ? null : Math.round(row.avgResponseTimeMs),
				max_response_time_ms:
					row.maxResponseTimeMs === null ? null : Math.round(row.maxResponseTimeMs),
			});
		}

		return result.data.length;
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
		for (let row of rows) {
			await this.write(db, {
				monitor_id: row.monitorId,
				monitor_type: monitorType,
				date,
				total_checks: row.totalChecks,
				successful_checks: row.successfulChecks,
				avg_response_time_ms:
					row.avgResponseTimeMs === null ? null : Math.round(row.avgResponseTimeMs),
				max_response_time_ms:
					row.maxResponseTimeMs === null ? null : Math.round(row.maxResponseTimeMs),
			});
		}

		return rows.length;
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

		for (let row of rows) {
			await this.write(db, {
				monitor_id: row.monitorId,
				monitor_type: "cron",
				date,
				total_checks: row.totalChecks,
				successful_checks: row.successfulChecks,
				avg_response_time_ms: null,
				max_response_time_ms: null,
			});
		}

		return rows.length;
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
