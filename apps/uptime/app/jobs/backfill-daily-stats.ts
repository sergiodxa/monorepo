import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import { monitorDailyStats } from "~/db/schema";

import type { Job } from "./base";

interface ResultAggregate {
	checks: { total: number; successful: number };
	responseTime: number[];
}

interface MonitorAggregate {
	monitorId: string;
	type: "http";
	results: Record<string, ResultAggregate>;
}

export default class BackfillDailyStatsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:backfill-daily-stats");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.backfill-daily-stats.started", { messageId: message.id });

			let monitors = await this.aggregateHttpMonitors();

			if (monitors.length === 0) {
				this.logger.info("job.backfill-daily-stats.no-data");
				return message.ack();
			}

			this.logger.info("job.backfill-daily-stats.aggregated", { monitors: monitors.length });

			let result = await Promise.all(
				monitors.map(async (monitor) => {
					return await Promise.all(
						Object.entries(monitor.results).map(async ([date, result]) => {
							let status = calculateStatus(result.checks.successful, result.checks.total);

							try {
								await this.db.insert(monitorDailyStats).values({
									monitorId: monitor.monitorId,
									monitorType: monitor.type,
									date,
									status,
									totalChecks: result.checks.total,
									successfulChecks: result.checks.successful,
									failedChecks: result.checks.total - result.checks.successful,
									avgResponseTimeMs: avg(result.responseTime),
									maxResponseTimeMs: Math.max(...result.responseTime),
									p95ResponseTimeMs: p95(result.responseTime),
								});

								return true;
							} catch (error) {
								this.logger.error("job.backfill-daily-stats.insert-error", {
									error: error instanceof Error ? error.message : String(error),
									monitorId: monitor.monitorId,
									date,
								});
								return false;
							}
						}),
					);
				}),
			);

			let rowsWritten = result.flat(2).filter((r) => r).length;

			this.logger.info("job.backfill-daily-stats.completed", { rowsWritten });

			await this.sendNotification({ rowsWritten });

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

	private async aggregateHttpMonitors() {
		let monitors = await this.db.query.monitors.findMany({
			with: {
				results: {
					where(fields, operators) {
						return operators.and(
							operators.isNotNull(fields.responseStatus),
							operators.isNotNull(fields.completedAt),
						);
					},
				},
			},
		});

		return monitors.map((monitor) => {
			let results = monitor.results.reduce(
				(group, result) => {
					let date = result.completedAt?.toISOString().split("T")[0];
					if (!date) return group;

					let current = group[date] ?? { checks: { total: 0, successful: 0 }, responseTime: [] };

					current.checks.total += 1;
					if (result.responseStatus === monitor.expectedStatus) {
						current.checks.successful += 1;
					}

					if (result.responseTimeMs !== null) {
						current.responseTime.push(result.responseTimeMs);
					}

					group[date] = current;
					return group;
				},
				{} as MonitorAggregate["results"],
			);

			return { monitorId: monitor.id, type: "http" as const, results } satisfies MonitorAggregate;
		});
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
