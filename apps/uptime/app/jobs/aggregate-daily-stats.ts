import { BatchedLogger } from "@pkg/logger";
import { isFailure } from "@pkg/result";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

import database from "~/db/index";
import { monitorDailyStats } from "~/db/schema";
import { pingUptime } from "~/lib/ping-uptime";
import { queryAnalytics } from "~/services/analytics.server";

let CRON_JOB_MONITOR_ID = "3f5a0689-1ced-4fcc-826d-3c1dc3c2795e";

import type { Job } from "./base";

interface AggregatedStats {
	monitorId: string;
	monitorType: "http" | "tcp";
	totalChecks: number;
	successfulChecks: number;
	failedChecks: number;
	avgResponseTimeMs: number;
	maxResponseTimeMs: number;
}

function getYesterdayDate(): string {
	let now = new Date();
	let yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	let year = yesterday.getUTCFullYear();
	let month = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
	let day = String(yesterday.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function calculateStatus(
	successfulChecks: number,
	totalChecks: number,
): "up" | "degraded" | "down" {
	if (totalChecks === 0) return "down";
	let successRate = successfulChecks / totalChecks;
	if (successRate >= 1) return "up";
	if (successRate >= 0.5) return "degraded";
	return "down";
}

export default class AggregateDailyStatsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:aggregate-daily-stats");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.aggregate_daily_stats.started", {
				messageId: message.id,
			});

			let date = getYesterdayDate();
			this.logger.info("job.aggregate_daily_stats.date", { date });

			// Query Analytics Engine for yesterday's data
			// blob1: monitorId, blob2: monitorType, blob3: status
			// double1: responseTimeMs, double2: count (always 1)
			// Status is "up" for successful checks, anything else is a failure
			let sql = `
				SELECT
					blob1 AS monitorId,
					blob2 AS monitorType,
					SUM(_sample_interval * double2) AS totalChecks,
					SUM(IF(blob3 = 'up', _sample_interval * double2, 0)) AS successfulChecks,
					SUM(IF(blob3 != 'up', _sample_interval * double2, 0)) AS failedChecks,
					AVG(double1) AS avgResponseTimeMs,
					MAX(double1) AS maxResponseTimeMs
				FROM PING_RESULTS
				WHERE
					toDate(timestamp) = toDate('${date}')
					AND blob2 IN ('http', 'tcp')
				GROUP BY blob1, blob2
			`;

			let result = await queryAnalytics<AggregatedStats>(sql);

			if (isFailure(result)) {
				this.logger.error("job.aggregate_daily_stats.query_failed", {
					error: result.error.message,
				});
				return message.retry();
			}

			let results = result.data;

			this.logger.info("job.aggregate_daily_stats.queried", {
				monitorCount: results.length,
			});

			if (results.length === 0) {
				this.logger.info("job.aggregate_daily_stats.no_data", { date });
				await pingUptime(CRON_JOB_MONITOR_ID, env.UPTIME_CRON_API_KEY);
				return message.ack();
			}

			// Upsert each monitor's stats into D1
			for (let stats of results) {
				let status = calculateStatus(stats.successfulChecks, stats.totalChecks);

				// Use INSERT ... ON CONFLICT for idempotency
				// Note: Drizzle doesn't have a unique constraint on (monitorId, monitorType, date)
				// so we need to use raw SQL or handle this with a delete-then-insert pattern
				// For simplicity with Drizzle, we'll delete existing and insert new
				await this.db
					.delete(monitorDailyStats)
					.where(
						and(
							eq(monitorDailyStats.monitorId, stats.monitorId),
							eq(monitorDailyStats.monitorType, stats.monitorType),
							eq(monitorDailyStats.date, date),
						),
					);

				await this.db.insert(monitorDailyStats).values({
					monitorId: stats.monitorId,
					monitorType: stats.monitorType,
					date,
					totalChecks: Math.round(stats.totalChecks),
					successfulChecks: Math.round(stats.successfulChecks),
					failedChecks: Math.round(stats.failedChecks),
					avgResponseTimeMs: Math.round(stats.avgResponseTimeMs),
					maxResponseTimeMs: Math.round(stats.maxResponseTimeMs),
					// p95 is not available from AE without quantile functions
					// which may not be supported, so we leave it null
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

			await pingUptime(CRON_JOB_MONITOR_ID, env.UPTIME_CRON_API_KEY);

			return message.ack();
		} catch (error) {
			this.logger.error("job.aggregate_daily_stats.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}
}
