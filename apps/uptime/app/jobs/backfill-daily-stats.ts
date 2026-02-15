import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

import database from "~/db/index";
import { monitorDailyStats } from "~/db/schema";

import type { Job } from "./base";

type AggregatedRow = {
	monitorId: string;
	date: string;
	totalChecks: number;
	successfulChecks: number;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
};

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

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	let n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export default class BackfillDailyStatsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:backfill-daily-stats");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.backfill-daily-stats.started", { messageId: message.id });

			let httpRows = await this.aggregateHttp();
			let tcpRows = await this.aggregateTcp();

			let rows = [...httpRows, ...tcpRows];

			if (rows.length === 0) {
				this.logger.info("job.backfill-daily-stats.no-data");
				return message.ack();
			}

			for (let row of rows) {
				let status = calculateStatus(row.successfulChecks, row.totalChecks);
				await this.db
					.delete(monitorDailyStats)
					.where(
						and(
							eq(monitorDailyStats.monitorId, row.monitorId),
							eq(monitorDailyStats.monitorType, row.monitorType),
							eq(monitorDailyStats.date, row.date),
						),
					);

				await this.db.insert(monitorDailyStats).values({
					monitorId: row.monitorId,
					monitorType: row.monitorType,
					date: row.date,
					totalChecks: row.totalChecks,
					successfulChecks: row.successfulChecks,
					failedChecks: row.totalChecks - row.successfulChecks,
					avgResponseTimeMs: row.avgResponseTimeMs,
					maxResponseTimeMs: row.maxResponseTimeMs,
					p95ResponseTimeMs: null,
					status,
				});
			}

			this.logger.info("job.backfill-daily-stats.completed", { rowsWritten: rows.length });

			await this.sendNotification({ rowsWritten: rows.length });

			return message.ack();
		} catch (error) {
			this.logger.error("job.backfill-daily-stats.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			await this.sendNotification({
				rowsWritten: 0,
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}

	private async sendNotification(params: { rowsWritten: number; error?: string }) {
		try {
			let resend = await import("~/clients/resend").then((m) => m.default);
			let subject = params.error ? "Uptime backfill failed" : "Uptime backfill completed";
			let statusLine = params.error
				? `Status: FAILED\nError: ${params.error}`
				: "Status: COMPLETED";
			let rowsLine = `Rows written: ${params.rowsWritten}`;

			await resend.emails.send({
				from: "Uptime <no-reply@uptime.sergiodxa.com>",
				to: "hello@sergiodxa.com",
				subject,
				text: [statusLine, rowsLine].join("\n"),
			});
		} catch (error) {
			this.logger.error("job.backfill-daily-stats.notify-failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async aggregateHttp() {
		let sql = `
			SELECT
				mr.monitor_id as monitorId,
				date(mr.completed_at) as date,
				COUNT(*) as totalChecks,
				SUM(CASE WHEN mr.response_status = m.expected_status THEN 1 ELSE 0 END) as successfulChecks,
				AVG(mr.response_time_ms) as avgResponseTimeMs,
				MAX(mr.response_time_ms) as maxResponseTimeMs
			FROM monitor_results mr
			JOIN monitors m ON m.id = mr.monitor_id
			WHERE mr.completed_at IS NOT NULL AND mr.response_status IS NOT NULL
			GROUP BY mr.monitor_id, date(mr.completed_at)
		`;

		let result = await this.db.$client.prepare(sql).all();
		let rows = (result?.results ?? []) as Array<Record<string, unknown>>;
		return rows.map((row) => ({
			monitorId: String(row.monitorId),
			monitorType: "http" as const,
			date: String(row.date),
			totalChecks: Number(row.totalChecks) || 0,
			successfulChecks: Number(row.successfulChecks) || 0,
			avgResponseTimeMs: toNumber(row.avgResponseTimeMs),
			maxResponseTimeMs: toNumber(row.maxResponseTimeMs),
		})) satisfies Array<AggregatedRow & { monitorType: "http" }>;
	}

	private async aggregateTcp() {
		let sql = `
			SELECT
				tmr.tcp_monitor_id as monitorId,
				date(tmr.checked_at) as date,
				COUNT(*) as totalChecks,
				SUM(CASE WHEN tmr.status = 'up' THEN 1 ELSE 0 END) as successfulChecks,
				AVG(tmr.response_time_ms) as avgResponseTimeMs,
				MAX(tmr.response_time_ms) as maxResponseTimeMs
			FROM tcp_monitor_results tmr
			WHERE 1=1
			GROUP BY tmr.tcp_monitor_id, date(tmr.checked_at)
		`;

		let result = await this.db.$client.prepare(sql).all();
		let rows = (result?.results ?? []) as Array<Record<string, unknown>>;
		return rows.map((row) => ({
			monitorId: String(row.monitorId),
			monitorType: "tcp" as const,
			date: String(row.date),
			totalChecks: Number(row.totalChecks) || 0,
			successfulChecks: Number(row.successfulChecks) || 0,
			avgResponseTimeMs: toNumber(row.avgResponseTimeMs),
			maxResponseTimeMs: toNumber(row.maxResponseTimeMs),
		})) satisfies Array<AggregatedRow & { monitorType: "tcp" }>;
	}
}
