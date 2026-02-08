import { logger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { calculateSslStatus, shouldSendSslAlert } from "~/services/check-ssl";

import type { Job } from "./base";

/**
 * Job that checks SSL certificate expiry for all monitors with SSL monitoring enabled.
 * Runs daily to update SSL status and send alerts for expiring certificates.
 */
export default class CheckSslJob implements Job {
	private db = database(env.DB);

	async run(message: Message): Promise<void> {
		try {
			// Get all monitors with SSL monitoring enabled
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

			logger.info("check-ssl.started", { monitorCount: monitors.length });

			for (let monitor of monitors) {
				await this.checkMonitorSsl(monitor);
			}

			logger.info("check-ssl.completed", { monitorCount: monitors.length });
			return message.ack();
		} catch (error) {
			logger.error("check-ssl.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
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

		// Update the SSL status in the database
		await this.db
			.update(schema.monitors)
			.set({
				sslStatus: status,
				sslLastCheckedAt: new Date(),
			})
			.where(eq(schema.monitors.id, monitor.id));

		logger.info("check-ssl.monitor-checked", {
			monitorId: monitor.id,
			monitorName: monitor.name,
			status,
			daysUntilExpiry,
		});

		// Check if we should send an alert
		if (shouldSendSslAlert(status, daysUntilExpiry)) {
			await this.sendSslAlerts(monitor, status, daysUntilExpiry);
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
	): Promise<void> {
		// Get alerts configured for this team/monitor
		let alerts = await this.db.query.alerts.findMany({
			where(fields, operators) {
				return operators.or(
					// Team-level alerts (no specific monitor)
					operators.and(
						operators.eq(fields.teamId, monitor.teamId),
						operators.isNull(fields.monitorId),
					),
					// Monitor-specific alerts
					operators.and(
						operators.eq(fields.teamId, monitor.teamId),
						operators.eq(fields.monitorId, monitor.id),
					),
				);
			},
		});

		if (alerts.length === 0) {
			logger.info("check-ssl.no-alerts-configured", {
				monitorId: monitor.id,
			});
			return;
		}

		let resend = await import("~/clients/resend").then((m) => m.default);

		let results = await Promise.allSettled(
			alerts.map(async (alert) => {
				if (alert.config.strategy === "email") {
					let subject = this.getEmailSubject(
						status,
						monitor.name,
						daysUntilExpiry,
						alert.config.config.subjectPrefix,
					);

					await resend.emails.send({
						to: alert.config.config.to,
						from: "Uptime <no-reply@ping.sergiodxa.com>",
						replyTo: "hello@sergiodxa.com",
						subject,
						text: this.getEmailBody(monitor, status, daysUntilExpiry),
					});

					logger.info("check-ssl.alert-sent", {
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

					logger.info("check-ssl.alert-sent", {
						monitorId: monitor.id,
						alertId: alert.id,
						alertType: "webhook",
					});
				}
			}),
		);

		let failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			logger.error("check-ssl.some-alerts-failed", {
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

		let url = `https://ping.sergiodxa.com/app/${monitor.team.id}/monitors/${monitor.id}`;

		return `${statusMessage}

Monitor: ${monitor.name}
URL: ${monitor.url}

Please renew your SSL certificate to avoid service disruptions.

View monitor: ${url}`;
	}
}
