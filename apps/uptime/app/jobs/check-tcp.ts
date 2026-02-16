import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import TcpMonitor from "~/models/tcp-monitor";
import { recordAlertEvent } from "~/services/alert-cooldown";
import { getLatestStatusFromAnalytics, writePingResult } from "~/services/analytics.server";
import { checkTcpConnection } from "~/services/check-tcp";

/**
 * Job that checks all enabled TCP monitors.
 * Runs on a schedule to verify TCP port connectivity.
 *
 * Note: TCP monitoring has limitations on Cloudflare Workers free plan.
 * See services/check-tcp.ts for details.
 */
export class CheckTcpJob extends Job {
	static override monitorId = "94276ec1-18f9-4dde-8a09-c5a00df29454";

	async perform(): Promise<void> {
		let db = database(env.DB);
		let monitors = await TcpMonitor.getEnabledMonitors(db);

		this.logger.info("job.check-tcp.monitors-loaded", { monitorCount: monitors.length });

		let successCount = 0;
		let errorCount = 0;

		for (let monitor of monitors) {
			try {
				await this.checkMonitor(db, monitor);
				successCount++;
			} catch {
				errorCount++;
			}
		}

		this.logger.info("job.check-tcp.completed", {
			monitorCount: monitors.length,
			successCount,
			errorCount,
		});
	}

	private async checkMonitor(
		db: ReturnType<typeof database>,
		monitor: {
			id: string;
			name: string;
			host: string;
			port: number;
			timeoutMs: number;
			teamId: string;
			lastStatus: "up" | "down" | "timeout" | null;
			team: { ownerId: string };
		},
	): Promise<void> {
		this.logger.info("tcp.check", {
			tcpMonitorId: monitor.id,
			host: monitor.host,
			port: monitor.port,
		});
		let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeoutMs);

		// Map "unsupported" to "down" for storage (since the enum doesn't include "unsupported")
		let storableStatus: "up" | "down" | "timeout" =
			result.status === "unsupported" ? "down" : result.status;

		// Store the result in AE only
		let previousStatusFromAe = await getLatestStatusFromAnalytics({
			teamId: monitor.teamId,
			monitorId: monitor.id,
			monitorType: "tcp",
		});

		if (isFailure(previousStatusFromAe)) {
			this.logger.error("job.check-tcp.previous-status-ae-error", {
				tcpMonitorId: monitor.id,
				error: previousStatusFromAe.error.message,
			});
		}

		writePingResult({
			monitorId: monitor.id,
			monitorType: "tcp",
			status: storableStatus === "up" ? "up" : storableStatus === "timeout" ? "timeout" : "down",
			responseTimeMs: result.responseTimeMs ?? 0,
			teamId: monitor.teamId,
			responseStatus: 0, // TCP doesn't have HTTP status
			expectedStatus: 0,
		});

		this.logger.info("job.check-tcp.analytics-write", {
			tcpMonitorId: monitor.id,
			status: storableStatus,
		});

		// Check for status change before updating
		let previousStatus: "up" | "down" | "timeout" | null = null;
		if (!isFailure(previousStatusFromAe) && previousStatusFromAe.data.status) {
			if (previousStatusFromAe.data.status === "up") previousStatus = "up";
			else if (previousStatusFromAe.data.status === "timeout") previousStatus = "timeout";
			else previousStatus = "down";
		} else if (monitor.lastStatus) {
			previousStatus = monitor.lastStatus;
		}
		let statusChanged =
			previousStatus !== null &&
			((previousStatus === "up" && storableStatus !== "up") ||
				(previousStatus !== "up" && storableStatus === "up"));

		this.logger.info("job.check-tcp.monitor-checked", {
			tcpMonitorId: monitor.id,
			status: result.status,
			responseTimeMs: result.responseTimeMs,
			previousStatus,
			statusChanged,
		});

		// Send alerts on status changes
		if (statusChanged) {
			await this.sendTcpAlerts(
				db,
				monitor,
				storableStatus,
				result.responseTimeMs ?? null,
				result.errorMessage ?? null,
			);
		}
	}

	private async sendTcpAlerts(
		db: ReturnType<typeof database>,
		monitor: {
			id: string;
			name: string;
			host: string;
			port: number;
			teamId: string;
			lastStatus: "up" | "down" | "timeout" | null;
			team: { ownerId: string };
		},
		newStatus: "up" | "down" | "timeout",
		responseTimeMs: number | null,
		errorMessage: string | null,
	): Promise<void> {
		let isRecovery = newStatus === "up";

		// Get alerts configured for this team
		let alerts = await db.query.alerts.findMany({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, monitor.teamId),
					operators.isNull(fields.monitorId), // Team-level alerts
				);
			},
		});

		// Filter alerts based on recovery notification settings
		let alertsToSend = alerts.filter((alert) => {
			if (isRecovery) {
				return alert.notifyOnRecovery;
			}
			return true;
		});

		if (alertsToSend.length === 0) {
			this.logger.info("job.check-tcp.no-alerts-configured", {
				tcpMonitorId: monitor.id,
				isRecovery,
			});
			return;
		}

		let resend = await import("~/clients/resend").then((m) => m.default);

		let results = await Promise.allSettled(
			alertsToSend.map(async (alert) => {
				let sentAt = new Date();
				let eventType: "up" | "down" = newStatus === "up" ? "up" : "down";
				let snapshot = {
					type: "tcp" as const,
					status: newStatus,
					responseTimeMs,
					host: monitor.host,
					port: monitor.port,
				};

				try {
					if (alert.config.strategy === "email") {
						let subject = this.getEmailSubject(
							newStatus,
							monitor.name,
							isRecovery,
							alert.config.config.subjectPrefix,
						);

						await resend.emails.send({
							to: alert.config.config.to,
							from: "Uptime <no-reply@uptime.sergiodxa.com>",
							replyTo: "hello@sergiodxa.com",
							subject,
							text: this.getEmailBody(monitor, newStatus, errorMessage, isRecovery),
						});

						this.logger.info("job.check-tcp.alert-sent", {
							tcpMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "email",
							isRecovery,
						});
					}

					if (alert.config.strategy === "webhook") {
						let payload = {
							type: isRecovery ? "tcp_recovery" : "tcp_failure",
							monitor: {
								id: monitor.id,
								name: monitor.name,
								host: monitor.host,
								port: monitor.port,
							},
							status: newStatus,
							errorMessage,
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

						this.logger.info("job.check-tcp.alert-sent", {
							tcpMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "webhook",
							isRecovery,
						});
					}

					if (alert.config.strategy === "slack") {
						let message = this.getSlackMessage(monitor, newStatus, errorMessage, isRecovery);

						let response = await fetch(alert.config.config.webhookUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								text: message,
								...(alert.config.config.channel ? { channel: alert.config.config.channel } : {}),
							}),
						});

						if (!response.ok) {
							throw new Error(`Slack webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-tcp.alert-sent", {
							tcpMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "slack",
							isRecovery,
						});
					}

					if (alert.config.strategy === "discord") {
						let message = this.getDiscordMessage(monitor, newStatus, errorMessage, isRecovery);

						let response = await fetch(alert.config.config.webhookUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ content: message }),
						});

						if (!response.ok) {
							throw new Error(`Discord webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-tcp.alert-sent", {
							tcpMonitorId: monitor.id,
							alertId: alert.id,
							alertType: "discord",
							isRecovery,
						});
					}

					await recordAlertEvent(db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: "sent",
						sentAt,
						monitorType: "tcp",
						monitorName: monitor.name,
						snapshot,
					});
				} catch (error) {
					let errorMessageLogged = error instanceof Error ? error.message : String(error);
					await recordAlertEvent(db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: "failed",
						sentAt,
						errorMessage: errorMessageLogged,
						monitorType: "tcp",
						monitorName: monitor.name,
						snapshot,
					});
					throw error;
				}
			}),
		);

		let failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			this.logger.error("job.check-tcp.some-alerts-failed", {
				tcpMonitorId: monitor.id,
				failedCount: failed.length,
				totalCount: results.length,
			});
		}
	}

	private getEmailSubject(
		status: "up" | "down" | "timeout",
		monitorName: string,
		isRecovery: boolean,
		subjectPrefix?: string,
	): string {
		let prefix = subjectPrefix ?? "[TCP ALERT]";

		if (isRecovery) {
			return `${prefix} TCP monitor RECOVERED: ${monitorName}`;
		}

		if (status === "timeout") {
			return `${prefix} TCP monitor TIMEOUT: ${monitorName}`;
		}

		return `${prefix} TCP monitor DOWN: ${monitorName}`;
	}

	private getEmailBody(
		monitor: { name: string; host: string; port: number; teamId: string },
		status: "up" | "down" | "timeout",
		errorMessage: string | null,
		isRecovery: boolean,
	): string {
		let statusMessage = isRecovery
			? `TCP monitor ${monitor.name} is back UP.`
			: status === "timeout"
				? `TCP monitor ${monitor.name} timed out.`
				: `TCP monitor ${monitor.name} is DOWN.`;

		let url = `https://uptime.sergiodxa.com/app/${monitor.teamId}/tcp/${monitor.name}`;

		let body = `${statusMessage}

Monitor: ${monitor.name}
Host: ${monitor.host}
Port: ${monitor.port}
Status: ${status.toUpperCase()}
`;

		if (errorMessage) {
			body += `Error: ${errorMessage}\n`;
		}

		body += `\nView monitor: ${url}`;

		return body;
	}

	private getSlackMessage(
		monitor: { name: string; host: string; port: number },
		status: "up" | "down" | "timeout",
		errorMessage: string | null,
		isRecovery: boolean,
	): string {
		let emoji = isRecovery ? ":white_check_mark:" : status === "timeout" ? ":hourglass:" : ":x:";
		let statusText = isRecovery ? "RECOVERED" : status === "timeout" ? "TIMEOUT" : "DOWN";

		let message = `${emoji} *TCP ${statusText}*: ${monitor.name}\n`;
		message += `Host: \`${monitor.host}:${monitor.port}\`\n`;

		if (errorMessage && !isRecovery) {
			message += `Error: ${errorMessage}\n`;
		}

		return message;
	}

	private getDiscordMessage(
		monitor: { name: string; host: string; port: number },
		status: "up" | "down" | "timeout",
		errorMessage: string | null,
		isRecovery: boolean,
	): string {
		let statusText = isRecovery ? "RECOVERED" : status === "timeout" ? "TIMEOUT" : "DOWN";

		let message = `**TCP ${statusText}**: ${monitor.name}\n`;
		message += `Host: \`${monitor.host}:${monitor.port}\`\n`;

		if (errorMessage && !isRecovery) {
			message += `Error: ${errorMessage}\n`;
		}

		return message;
	}
}
