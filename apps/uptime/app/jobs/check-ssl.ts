import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { pingUptime } from "~/lib/ping-uptime";
import { recordAlertEvent } from "~/services/alert-cooldown";
import { calculateSslStatus, shouldSendSslAlert } from "~/services/check-ssl";

import type { Job } from "./base";

/**
 * Job that checks SSL certificate expiry for all monitors with SSL monitoring enabled.
 * Runs daily to update SSL status and send alerts for expiring certificates.
 */
export default class CheckSslJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:check-ssl");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.check-ssl.started", { messageId: message.id });

			let monitors = await this.db.query.monitors.findMany({
				columns: {
					id: true,
					name: true,
					url: true,
					sslMonitoringEnabled: true,
					sslExpiryWarningDays: true,
					sslExpiresAt: true,
					sslIssuer: true,
					teamId: true,
				},
				where(fields, operators) {
					return operators.eq(fields.sslMonitoringEnabled, true);
				},
				with: {
					team: {
						columns: { id: true, ownerId: true },
					},
				},
			});

			this.logger.info("database.query.complete", { monitorCount: monitors.length });

			let successCount = 0;
			let errorCount = 0;

			for (let monitor of monitors) {
				try {
					await this.checkMonitorSsl(monitor);
					successCount++;
				} catch {
					errorCount++;
				}
			}

			this.logger.info("job.check-ssl.completed", {
				monitorCount: monitors.length,
				successCount,
				errorCount,
			});

			await pingUptime("2140cbc2-e18e-441c-9ef9-3d516a9e3a19", env.UPTIME_CRON_API_KEY);
			return message.ack();
		} catch (error) {
			this.logger.error("job.check-ssl.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}

	private async checkMonitorSsl(monitor: {
		id: string;
		name: string;
		url: string;
		sslMonitoringEnabled: boolean;
		sslExpiryWarningDays: number;
		sslExpiresAt: Date | null;
		sslIssuer: string | null;
		teamId: string;
		team: { id: string; ownerId: string };
	}): Promise<void> {
		let { status, daysUntilExpiry } = calculateSslStatus(
			monitor.sslExpiresAt,
			monitor.sslExpiryWarningDays,
		);

		await this.db
			.update(schema.monitors)
			.set({
				sslStatus: status,
				sslLastCheckedAt: new Date(),
			})
			.where(eq(schema.monitors.id, monitor.id));

		this.logger.info("job.check-ssl.monitor-checked", {
			monitorId: monitor.id,
			status,
			daysUntilExpiry,
		});

		if (shouldSendSslAlert(status, daysUntilExpiry)) {
			await this.sendSslAlerts(monitor, status, daysUntilExpiry, monitor.sslExpiresAt);
		}
	}

	private async sendSslAlerts(
		monitor: {
			id: string;
			name: string;
			url: string;
			teamId: string;
			team: { id: string; ownerId: string };
		},
		status: string,
		daysUntilExpiry: number | null,
		expiresAt: Date | null,
	): Promise<void> {
		let alerts = await this.db.query.alerts.findMany({
			where(fields, operators) {
				return operators.or(
					operators.and(
						operators.eq(fields.teamId, monitor.teamId),
						operators.isNull(fields.monitorId),
					),
					operators.and(
						operators.eq(fields.teamId, monitor.teamId),
						operators.eq(fields.monitorId, monitor.id),
					),
				);
			},
		});

		if (alerts.length === 0) {
			this.logger.info("job.check-ssl.no-alerts-configured", { monitorId: monitor.id });
			return;
		}

		let resend = await import("~/clients/resend").then((m) => m.default);

		let results = await Promise.allSettled(
			alerts.map(async (alert) => {
				let sentAt = new Date();
				let eventType: "down" | "degraded" = status === "expired" ? "down" : "degraded";
				let hostname = (() => {
					try {
						return new URL(monitor.url).hostname;
					} catch {
						return monitor.url;
					}
				})();
				let snapshot = {
					type: "ssl" as const,
					status,
					expiresAt: expiresAt ? expiresAt.toISOString() : null,
					daysUntilExpiry,
					hostname,
				};

				try {
					if (alert.config.strategy === "email") {
						let subject = this.getEmailSubject(
							status,
							monitor.name,
							daysUntilExpiry,
							alert.config.config.subjectPrefix,
						);

						await resend.emails.send({
							to: alert.config.config.to,
							from: "Uptime <no-reply@uptime.sergiodxa.com>",
							replyTo: "hello@uptime.sergiodxa.com",
							subject,
							text: this.getEmailBody(monitor, status, daysUntilExpiry),
						});

						this.logger.info("job.check-ssl.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "email",
						});
					}

					if (alert.config.strategy === "webhook") {
						let payload = {
							type: "ssl_expiry",
							monitor: {
								id: monitor.id,
								name: monitor.name,
								url: monitor.url,
							},
							ssl: {
								status,
								daysUntilExpiry,
							},
							timestamp: new Date().toISOString(),
						};

						let response = await fetch(alert.config.config.url, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								...(alert.config.config.secret
									? { "X-Webhook-Secret": alert.config.config.secret }
									: {}),
							},
							body: JSON.stringify(payload),
						});

						if (!response.ok) {
							throw new Error(`Webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-ssl.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "webhook",
						});
					}

					await recordAlertEvent(this.db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: "sent",
						sentAt,
						monitorType: "ssl",
						monitorName: monitor.name,
						snapshot,
					});
				} catch (error) {
					let errorMessage = error instanceof Error ? error.message : String(error);
					await recordAlertEvent(this.db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: "failed",
						sentAt,
						errorMessage,
						monitorType: "ssl",
						monitorName: monitor.name,
						snapshot,
					});
					throw error;
				}
			}),
		);

		let failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			this.logger.error("job.check-ssl.some-alerts-failed", {
				monitorId: monitor.id,
				failedCount: failed.length,
				totalCount: results.length,
			});
		}
	}

	private getEmailSubject(
		status: string,
		monitorName: string,
		daysUntilExpiry: number | null,
		subjectPrefix?: string,
	): string {
		let prefix = subjectPrefix ?? "[SSL ALERT]";

		if (status === "expired") {
			return `${prefix} SSL certificate EXPIRED for ${monitorName}`;
		}

		return `${prefix} SSL certificate expires in ${daysUntilExpiry} days for ${monitorName}`;
	}

	private getEmailBody(
		monitor: { name: string; url: string; id: string; team: { id: string } },
		status: string,
		daysUntilExpiry: number | null,
	): string {
		let statusMessage =
			status === "expired"
				? `The SSL certificate for ${monitor.name} has EXPIRED.`
				: `The SSL certificate for ${monitor.name} will expire in ${daysUntilExpiry} days.`;

		let url = `https://uptime.sergiodxa.com/app/${monitor.team.id}/monitors/${monitor.id}`;

		return `${statusMessage}

Monitor: ${monitor.name}
URL: ${monitor.url}

Please renew your SSL certificate to avoid service disruptions.

View monitor: ${url}`;
	}
}
