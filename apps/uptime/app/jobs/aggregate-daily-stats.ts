import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

import database from "~/db/index";
import { monitorDailyStats } from "~/db/schema";
import { queryAnalytics } from "~/services/analytics.server";

export namespace AggregateDailyStatsJob {
	export interface Stats {
		monitorId: string;
		monitorType: "http" | "tcp";
		totalChecks: number;
		successfulChecks: number;
		failedChecks: number;
		avgResponseTimeMs: number;
		maxResponseTimeMs: number;
	}
}

export class AggregateDailyStatsJob extends Job {
	static override monitorId = "3f5a0689-1ced-4fcc-826d-3c1dc3c2795e";

	async perform(): Promise<void> {
		let db = database(env.DB);
		let date = this.getYesterdayDate();

		this.logger.info("job.aggregate_daily_stats.date", { date });

		// Query Analytics Engine for yesterday's data
		let sql = `
			SELECT
				blob1 AS monitorId,
				blob2 AS monitorType,
				SUM(_sample_interval * double2) AS totalChecks,
				SUM(IF(blob3 = 'up', _sample_interval * double2, 0)) AS successfulChecks,
				SUM(IF(blob3 != 'up', _sample_interval * double2, 0)) AS failedChecks,
				AVG(double1) AS avgResponseTimeMs,
				MAX(double1) AS maxResponseTimeMs
			FROM uptime_monitor_results
			WHERE
				toDate(timestamp) = toDate('${date}')
				AND blob2 IN ('http', 'tcp')
			GROUP BY blob1, blob2
		`;

		let result = await queryAnalytics<AggregateDailyStatsJob.Stats>(sql);

		if (isFailure(result)) {
			this.logger.error("job.aggregate_daily_stats.query_failed", {
				error: result.error.message,
			});
			throw new Job.RetryError("Analytics query failed", { cause: result.error });
		}

		let results = result.data;

		this.logger.info("job.aggregate_daily_stats.queried", {
			monitorCount: results.length,
		});

		if (results.length === 0) {
			this.logger.info("job.aggregate_daily_stats.no_data", { date });
			return;
		}

		// Upsert each monitor's stats into D1
		for (let stats of results) {
			let status = this.calculateStatus(stats.successfulChecks, stats.totalChecks);

			await db
				.delete(monitorDailyStats)
				.where(
					and(
						eq(monitorDailyStats.monitorId, stats.monitorId),
						eq(monitorDailyStats.monitorType, stats.monitorType),
						eq(monitorDailyStats.date, date),
					),
				);

			await db.insert(monitorDailyStats).values({
				monitorId: stats.monitorId,
				monitorType: stats.monitorType,
				date,
				totalChecks: Math.round(stats.totalChecks),
				successfulChecks: Math.round(stats.successfulChecks),
				failedChecks: Math.round(stats.failedChecks),
				avgResponseTimeMs: Math.round(stats.avgResponseTimeMs),
				maxResponseTimeMs: Math.round(stats.maxResponseTimeMs),
				p95ResponseTimeMs: null,
				status,
			});

			this.logger.info("job.aggregate_daily_stats.upserted", {
				monitorId: stats.monitorId,
				monitorType: stats.monitorType,
				date,
				status,
				totalChecks: Math.round(stats.totalChecks),
			});
		}

		this.logger.info("job.aggregate_daily_stats.completed", {
			date,
			monitorsProcessed: results.length,
		});
	}

	private calculateStatus(
		successfulChecks: number,
		totalChecks: number,
	): "up" | "degraded" | "down" {
		if (totalChecks === 0) return "down";
		let successRate = successfulChecks / totalChecks;
		if (successRate >= 1) return "up";
		if (successRate >= 0.5) return "degraded";
		return "down";
	}

	private getYesterdayDate(): string {
		let now = new Date();
		let yesterday = new Date(now);
		yesterday.setUTCDate(yesterday.getUTCDate() - 1);
		let year = yesterday.getUTCFullYear();
		let month = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
		let day = String(yesterday.getUTCDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
