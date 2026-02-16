import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";
import { z } from "zod/v4";

import database from "~/db/index";
import { monitorDailyStats } from "~/db/schema";

interface ResultAggregate {
	date: string;
	checks: { total: number; successful: number };
	responseTime: number[];
}

interface MonitorAggregate {
	monitorId: string;
	type: "http";
	results: Set<ResultAggregate>;
}

export class BackfillDailyStatsJob extends Job {
	async perform(): Promise<void> {
		let db = database(env.DB);

		let monitors = await this.aggregateHttpMonitors(db);

		if (monitors.size === 0) {
			this.logger.info("job.backfill-daily-stats.no-data");
			return;
		}

		this.logger.info("job.backfill-daily-stats.aggregated", { monitors: monitors.size });

		let rowsWritten = 0;
		for (let monitor of monitors.values()) {
			for (let result of monitor.results) {
				let status = calculateStatus(result.checks.successful, result.checks.total);
				try {
					await db.insert(monitorDailyStats).values({
						monitorId: monitor.monitorId,
						monitorType: monitor.type,
						date: result.date,
						status,
						totalChecks: result.checks.total,
						successfulChecks: result.checks.successful,
						failedChecks: result.checks.total - result.checks.successful,
						avgResponseTimeMs: avg(result.responseTime),
						maxResponseTimeMs: Math.max(...result.responseTime),
						p95ResponseTimeMs: p95(result.responseTime),
					});
					rowsWritten++;
				} catch (error) {
					this.logger.error("job.backfill-daily-stats.insert-error", {
						error: error instanceof Error ? error.message : String(error),
						monitorId: monitor.monitorId,
						date: result.date,
					});
				}
			}
		}

		this.logger.info("job.backfill-daily-stats.completed", { rowsWritten });

		await this.sendNotification({ rowsWritten });
	}

	private async sendNotification(params: { rowsWritten: number; error?: string }) {
		try {
			if (!env.RESEND_API_TOKEN) {
				this.logger.info("job.backfill-daily-stats.notify-skipped", {
					reason: "missing RESEND_API_TOKEN",
					rowsWritten: params.rowsWritten,
					error: params.error,
				});
				return;
			}

			let resend = await import("~/clients/resend").then((m) => m.default);
			let subject = params.error ? "Uptime backfill failed" : "Uptime backfill completed";
			let statusLine = params.error
				? `Status: FAILED\nError: ${params.error}`
				: "Status: COMPLETED";
			let rowsLine = `Rows written: ${params.rowsWritten}`;

			let result = await resend.emails.send({
				from: "Uptime <no-reply@uptime.sergiodxa.com>",
				to: "hello@sergiodxa.com",
				subject,
				text: [statusLine, rowsLine].join("\n"),
			});

			if (result.error) {
				this.logger.error("job.backfill-daily-stats.notify-error", {
					error: result.error,
					rowsWritten: params.rowsWritten,
				});
			}

			if (result.data) {
				this.logger.info("job.backfill-daily-stats.notify-sent", {
					rowsWritten: params.rowsWritten,
					id: result.data.id ?? null,
				});
			}
		} catch (error) {
			this.logger.error("job.backfill-daily-stats.notify-failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async aggregateHttpMonitors(
		db: ReturnType<typeof database>,
	): Promise<Map<string, MonitorAggregate>> {
		let rowSchema = z.object({
			monitorId: z.string(),
			date: z.string(),
			totalChecks: z.coerce.number(),
			successfulChecks: z.coerce.number(),
			responseTimesJson: z.string().transform((val) => {
				try {
					let parsed = JSON.parse(val);
					if (!Array.isArray(parsed)) return [];
					return parsed.filter((v): v is number => typeof v === "number" && v !== null);
				} catch {
					return [];
				}
			}),
		});

		let sql = `
			SELECT
				mr.monitor_id as monitorId,
				strftime('%Y-%m-%d', mr.completed_at / 1000, 'unixepoch') as date,
				COUNT(*) as totalChecks,
				SUM(CASE WHEN mr.response_status = m.expected_status THEN 1 ELSE 0 END) as successfulChecks,
				json_group_array(mr.response_time_ms) as responseTimesJson
			FROM monitor_results mr
			JOIN monitors m ON m.id = mr.monitor_id
			WHERE mr.completed_at IS NOT NULL AND mr.response_status IS NOT NULL
			GROUP BY mr.monitor_id, strftime('%Y-%m-%d', mr.completed_at / 1000, 'unixepoch')
			HAVING date IS NOT NULL
		`;

		let result = await db.$client.prepare(sql).all();

		let map = new Map<string, MonitorAggregate>();

		for (let rawRow of result?.results ?? []) {
			let parsed = rowSchema.safeParse(rawRow);
			if (!parsed.success) continue;

			let row = parsed.data;

			let monitor = map.get(row.monitorId);

			if (!monitor) {
				monitor = { monitorId: row.monitorId, type: "http", results: new Set<ResultAggregate>() };
				map.set(row.monitorId, monitor);
			}

			monitor.results.add({
				date: row.date,
				checks: {
					total: row.totalChecks,
					successful: row.successfulChecks,
				},
				responseTime: row.responseTimesJson,
			});
		}

		return map;
	}
}

function avg(values: number[]): number | null {
	if (values.length === 0) return null;
	let sum = values.reduce((a, b) => a + b, 0);
	return sum / values.length;
}

function p95(values: number[]): number | null {
	if (values.length === 0) return null;
	let sorted = [...values].sort((a, b) => a - b);
	let index = Math.ceil(0.95 * sorted.length) - 1;
	return sorted[index] ?? null;
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
