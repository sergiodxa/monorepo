import { Json } from "@pkg/http/content-type";
import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";

export namespace CheckCronJobsJob {
	export type Monitor = {
		id: string;
		name: string;
		cronExpression: string;
		gracePeriodSeconds: number;
		timezone: string;
		status: "healthy" | "late" | "missed" | "new";
		alertOnLate: boolean;
		lastPingAt: Date | null;
		nextExpectedAt: Date | null;
		teamId: string;
		team: { id: string; ownerId: string };
	};

	export type Alert = schema.SelectAlert;
}

/**
 * Job that checks all enabled cron job monitors.
 * Runs on a schedule to detect late or missed cron executions.
 */
export class CheckCronJobsJob extends Job {
	static override monitorId = "70a5dba9-8447-4cc0-a5f6-d0e41dc6b9e5";

	async perform(): Promise<void> {
		let db = database(env.DB);
		let now = new Date();

		// Get all enabled cron job monitors that have a nextExpectedAt set
		let monitors = await db.query.cronJobMonitors.findMany({
			columns: {
				id: true,
				name: true,
				cronExpression: true,
				gracePeriodSeconds: true,
				timezone: true,
				status: true,
				alertOnLate: true,
				lastPingAt: true,
				nextExpectedAt: true,
				teamId: true,
			},
			where(fields, operators) {
				return operators.and(
					operators.isNotNull(fields.enabledAt),
					operators.isNotNull(fields.nextExpectedAt),
					// Only check monitors that are healthy or late (not new or already missed)
					operators.or(operators.eq(fields.status, "healthy"), operators.eq(fields.status, "late")),
				);
			},
			with: {
				team: {
					columns: { id: true, ownerId: true },
				},
			},
		});

		this.logger.info("job.check-cron-jobs.monitors-loaded", { monitorCount: monitors.length });

		let lateCount = 0;
		let missedCount = 0;
		let alertsSentCount = 0;

		for (let monitor of monitors) {
			if (!monitor.nextExpectedAt) continue;

			let nextExpectedAt = new Date(monitor.nextExpectedAt);
			let gracePeriodMs = monitor.gracePeriodSeconds * 1000;
			let missedThreshold = new Date(nextExpectedAt.getTime() + gracePeriodMs);

			// Determine the new status
			let newStatus: "late" | "missed" | null = null;

			if (monitor.status === "healthy" && now > nextExpectedAt && now <= missedThreshold) {
				// Healthy -> Late: past expected time but within grace period
				newStatus = "late";
				lateCount++;
			} else if (now > missedThreshold) {
				// Either healthy or late -> Missed: past grace period
				newStatus = "missed";
				missedCount++;
			}

			if (newStatus) {
				// Update the monitor status
				await db
					.update(schema.cronJobMonitors)
					.set({ status: newStatus })
					.where(eq(schema.cronJobMonitors.id, monitor.id));

				this.logger.info("job.check-cron-jobs.status-changed", {
					cronJobMonitorId: monitor.id,
					previousStatus: monitor.status,
					newStatus,
				});

				// Determine if we should send alerts
				let shouldAlert = false;
				if (newStatus === "missed") {
					// Always alert on missed
					shouldAlert = true;
				} else if (newStatus === "late" && monitor.alertOnLate) {
					// Only alert on late if configured
					shouldAlert = true;
				}

				if (shouldAlert) {
					let alertsSent = await this.sendAlerts(
						db,
						monitor as CheckCronJobsJob.Monitor,
						newStatus,
						now,
					);
					alertsSentCount += alertsSent;
				}
			}
		}

		this.logger.info("job.check-cron-jobs.completed", {
			monitorCount: monitors.length,
			lateCount,
			missedCount,
			alertsSentCount,
		});
	}

	private async sendAlerts(
		db: ReturnType<typeof database>,
		monitor: CheckCronJobsJob.Monitor,
		newStatus: "late" | "missed",
		now: Date,
	): Promise<number> {
		// Get team-level alerts (where monitorId is NULL)
		let alerts = await db.query.alerts.findMany({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, monitor.teamId),
					operators.isNull(fields.monitorId),
				);
			},
		});

		if (alerts.length === 0) {
			this.logger.info("job.check-cron-jobs.no-alerts-configured", {
				cronJobMonitorId: monitor.id,
			});
			return 0;
		}

		// Check cooldowns and filter alerts
		let alertsToSend: CheckCronJobsJob.Alert[] = [];
		for (let alert of alerts) {
			let shouldSend = await this.checkCooldown(db, alert, monitor.id, now);
			if (shouldSend) {
				alertsToSend.push(alert);
			}
		}

		if (alertsToSend.length === 0) {
			this.logger.info("job.check-cron-jobs.all-alerts-in-cooldown", {
				cronJobMonitorId: monitor.id,
			});
			return 0;
		}

		let resend = await import("~/clients/resend").then((m) => m.default);

		let results = await Promise.allSettled(
			alertsToSend.map(async (alert) => {
				let eventType = newStatus === "late" ? "degraded" : "down";

				try {
					if (alert.config.strategy === "email") {
						let subject = this.getEmailSubject(
							newStatus,
							monitor.name,
							alert.config.config.subjectPrefix,
						);

						await resend.emails.send({
							to: alert.config.config.to,
							from: "Uptime <no-reply@uptime.sergiodxa.com>",
							replyTo: "hello@sergiodxa.com",
							subject,
							text: this.getEmailBody(monitor, newStatus),
						});

						this.logger.info("job.check-cron-jobs.alert-sent", {
							cronJobMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "email",
							status: newStatus,
						});
					}

					if (alert.config.strategy === "webhook") {
						let payload = {
							type: `cron_job_${newStatus}`,
							monitor: {
								id: monitor.id,
								name: monitor.name,
								cronExpression: monitor.cronExpression,
								timezone: monitor.timezone,
							},
							status: newStatus,
							lastPingAt: monitor.lastPingAt?.toISOString() ?? null,
							nextExpectedAt: monitor.nextExpectedAt?.toISOString() ?? null,
							timestamp: now.toISOString(),
						};

						let response = await fetch(alert.config.config.url, {
							method: "POST",
							headers: {
								"Content-Type": Json,
								...(alert.config.config.secret
									? { "X-Webhook-Secret": alert.config.config.secret }
									: {}),
							},
							body: JSON.stringify(payload),
						});

						if (!response.ok) {
							throw new Error(`Webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-cron-jobs.alert-sent", {
							cronJobMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "webhook",
							status: newStatus,
						});
					}

					if (alert.config.strategy === "slack") {
						let message = this.getSlackMessage(monitor, newStatus);

						let response = await fetch(alert.config.config.webhookUrl, {
							method: "POST",
							headers: { "Content-Type": Json },
							body: JSON.stringify({
								text: message,
								...(alert.config.config.channel ? { channel: alert.config.config.channel } : {}),
							}),
						});

						if (!response.ok) {
							throw new Error(`Slack webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-cron-jobs.alert-sent", {
							cronJobMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "slack",
							status: newStatus,
						});
					}

					if (alert.config.strategy === "discord") {
						let message = this.getDiscordMessage(monitor, newStatus);

						let response = await fetch(alert.config.config.webhookUrl, {
							method: "POST",
							headers: { "Content-Type": Json },
							body: JSON.stringify({ content: message }),
						});

						if (!response.ok) {
							throw new Error(`Discord webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-cron-jobs.alert-sent", {
							cronJobMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "discord",
							status: newStatus,
						});
					}

					// Record successful alert event
					await db.insert(schema.alertEvents).values({
						alertId: alert.id,
						monitorId: monitor.id, // Using cronJobMonitorId as monitorId for tracking
						eventType: eventType as "degraded" | "down",
						status: "sent",
						sentAt: now,
						monitorType: "cron",
						monitorName: monitor.name,
						snapshot: {
							type: "cron",
							status: newStatus,
							lastPingAt: monitor.lastPingAt?.toISOString() ?? null,
							nextExpectedAt: monitor.nextExpectedAt?.toISOString() ?? null,
							cronExpression: monitor.cronExpression,
							timezone: monitor.timezone,
						},
					});
				} catch (error) {
					// Record failed alert event
					await db.insert(schema.alertEvents).values({
						alertId: alert.id,
						monitorId: monitor.id,
						eventType: eventType as "degraded" | "down",
						status: "failed",
						sentAt: now,
						errorMessage: error instanceof Error ? error.message : String(error),
						monitorType: "cron",
						monitorName: monitor.name,
						snapshot: {
							type: "cron",
							status: newStatus,
							lastPingAt: monitor.lastPingAt?.toISOString() ?? null,
							nextExpectedAt: monitor.nextExpectedAt?.toISOString() ?? null,
							cronExpression: monitor.cronExpression,
							timezone: monitor.timezone,
						},
					});

					throw error;
				}
			}),
		);

		let successCount = results.filter((r) => r.status === "fulfilled").length;
		let failedCount = results.filter((r) => r.status === "rejected").length;

		if (failedCount > 0) {
			this.logger.error("job.check-cron-jobs.some-alerts-failed", {
				cronJobMonitorId: monitor.id,
				failedCount,
				totalCount: results.length,
			});
		}

		return successCount;
	}

	private async checkCooldown(
		db: ReturnType<typeof database>,
		alert: CheckCronJobsJob.Alert,
		monitorId: string,
		now: Date,
	): Promise<boolean> {
		// If no cooldown configured, always send
		if (alert.cooldownMinutes === 0) {
			return true;
		}

		// Check if there was a recent alert event for this alert + monitor combination
		let cooldownMs = alert.cooldownMinutes * 60 * 1000;
		let cooldownThreshold = new Date(now.getTime() - cooldownMs);

		let recentEvent = await db.query.alertEvents.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.alertId, alert.id),
					operators.eq(fields.monitorId, monitorId),
					operators.eq(fields.status, "sent"),
					operators.gte(fields.sentAt, cooldownThreshold),
				);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.sentAt);
			},
		});

		if (recentEvent) {
			this.logger.info("job.check-cron-jobs.alert-in-cooldown", {
				alertId: alert.id,
				monitorId,
				lastSentAt: recentEvent.sentAt,
				cooldownMinutes: alert.cooldownMinutes,
			});

			// Record that we skipped due to cooldown
			await db.insert(schema.alertEvents).values({
				alertId: alert.id,
				monitorId,
				eventType: "down",
				status: "skipped_cooldown",
				sentAt: now,
				monitorType: "cron",
			});

			return false;
		}

		return true;
	}

	private getEmailSubject(
		status: "late" | "missed",
		monitorName: string,
		subjectPrefix?: string,
	): string {
		let prefix = subjectPrefix ?? "[CRON ALERT]";

		if (status === "late") {
			return `${prefix} Cron job LATE: ${monitorName}`;
		}

		return `${prefix} Cron job MISSED: ${monitorName}`;
	}

	private getEmailBody(monitor: CheckCronJobsJob.Monitor, status: "late" | "missed"): string {
		let statusMessage =
			status === "late"
				? `Cron job ${monitor.name} is running late.`
				: `Cron job ${monitor.name} has missed its scheduled execution.`;

		let url = `https://uptime.sergiodxa.com/app/${monitor.teamId}/cron-jobs/${monitor.id}`;

		let body = `${statusMessage}

Monitor: ${monitor.name}
Schedule: ${monitor.cronExpression}
Timezone: ${monitor.timezone}
Status: ${status.toUpperCase()}
`;

		if (monitor.lastPingAt) {
			body += `Last Ping: ${monitor.lastPingAt.toISOString()}\n`;
		}

		if (monitor.nextExpectedAt) {
			body += `Expected At: ${monitor.nextExpectedAt.toISOString()}\n`;
		}

		body += `\nView monitor: ${url}`;

		return body;
	}

	private getSlackMessage(monitor: CheckCronJobsJob.Monitor, status: "late" | "missed"): string {
		let emoji = status === "late" ? ":warning:" : ":x:";
		let statusText = status.toUpperCase();

		let message = `${emoji} *Cron Job ${statusText}*: ${monitor.name}\n`;
		message += `Schedule: \`${monitor.cronExpression}\` (${monitor.timezone})\n`;

		if (monitor.lastPingAt) {
			message += `Last Ping: ${monitor.lastPingAt.toISOString()}\n`;
		}

		return message;
	}

	private getDiscordMessage(monitor: CheckCronJobsJob.Monitor, status: "late" | "missed"): string {
		let statusText = status.toUpperCase();

		let message = `**Cron Job ${statusText}**: ${monitor.name}\n`;
		message += `Schedule: \`${monitor.cronExpression}\` (${monitor.timezone})\n`;

		if (monitor.lastPingAt) {
			message += `Last Ping: ${monitor.lastPingAt.toISOString()}\n`;
		}

		return message;
	}
}
