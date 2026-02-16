import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { pingUptime } from "~/lib/ping-uptime";
import { recordAlertEvent } from "~/services/alert-cooldown";
import { checkDns, type DnsRecordType } from "~/services/check-dns";

import type { Job } from "./base";

/**
 * Job that checks all enabled DNS monitors.
 * Runs hourly to verify DNS records and detect changes.
 */
export default class CheckDnsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:check-dns");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.check-dns.started", { messageId: message.id });

			// Get all enabled DNS monitors
			let monitors = await this.db.query.dnsMonitors.findMany({
				columns: {
					id: true,
					name: true,
					domain: true,
					recordType: true,
					expectedValue: true,
					lastValue: true,
					teamId: true,
				},
				where(fields, operators) {
					return operators.eq(fields.isEnabled, true);
				},
				with: {
					team: {
						columns: { id: true, ownerId: true },
					},
				},
			});

			this.logger.info("job.check-dns.monitors-loaded", { monitorCount: monitors.length });

			let successCount = 0;
			let errorCount = 0;

			for (let monitor of monitors) {
				try {
					await this.checkMonitorDns(monitor);
					successCount++;
				} catch {
					errorCount++;
				}
			}

			this.logger.info("job.check-dns.completed", {
				monitorCount: monitors.length,
				successCount,
				errorCount,
			});

			await pingUptime("3a620acd-43f9-4f48-9a32-b9a87698e44e", env.UPTIME_CRON_API_KEY);
			return message.ack();
		} catch (error) {
			this.logger.error("job.check-dns.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}

	private async checkMonitorDns(monitor: {
		id: string;
		name: string;
		domain: string;
		recordType: string;
		expectedValue: string | null;
		lastValue: string | null;
		teamId: string;
		team: { id: string; ownerId: string };
	}): Promise<void> {
		let result = await checkDns(
			monitor.domain,
			monitor.recordType as DnsRecordType,
			monitor.expectedValue,
			monitor.lastValue,
		);

		// Store the result
		await this.db.insert(schema.dnsMonitorResults).values({
			dnsMonitorId: monitor.id,
			status: result.status,
			resolvedValue: result.resolvedValue,
			responseTimeMs: result.responseTimeMs,
			errorMessage: result.errorMessage,
			checkedAt: new Date(),
		});

		// Update the monitor with the latest status
		await this.db
			.update(schema.dnsMonitors)
			.set({
				lastCheckedAt: new Date(),
				lastStatus: result.status,
				lastValue: result.resolvedValue,
			})
			.where(eq(schema.dnsMonitors.id, monitor.id));

		this.logger.info("job.check-dns.monitor-checked", {
			monitorId: monitor.id,
			status: result.status,
		});

		// Send alerts if status is changed or error
		if (result.status !== "ok") {
			await this.sendDnsAlerts(monitor, result);
		}
	}

	private async sendDnsAlerts(
		monitor: {
			id: string;
			name: string;
			domain: string;
			recordType: string;
			teamId: string;
			team: { id: string; ownerId: string };
		},
		result: {
			status: string;
			resolvedValue: string | null;
			errorMessage?: string;
		},
	): Promise<void> {
		// Get alerts configured for this team
		let alerts = await this.db.query.alerts.findMany({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, monitor.teamId),
					operators.isNull(fields.monitorId), // Team-level alerts
				);
			},
		});

		if (alerts.length === 0) {
			this.logger.info("job.check-dns.no-alerts-configured", {
				monitorId: monitor.id,
			});
			return;
		}

		let resend = await import("~/clients/resend").then((m) => m.default);

		let results = await Promise.allSettled(
			alerts.map(async (alert) => {
				let sentAt = new Date();
				let eventType: "down" | "degraded" = result.status === "error" ? "down" : "degraded";
				let snapshot = {
					type: "dns" as const,
					status: result.status,
					resolvedValue: result.resolvedValue,
					domain: monitor.domain,
					recordType: monitor.recordType,
				};

				try {
					if (alert.config.strategy === "email") {
						let subject = this.getEmailSubject(
							result.status,
							monitor.name,
							alert.config.config.subjectPrefix,
						);

						await resend.emails.send({
							to: alert.config.config.to,
							from: "Uptime <no-reply@uptime.sergiodxa.com>",
							replyTo: "hello@sergiodxa.com",
							subject,
							text: this.getEmailBody(monitor, result),
						});

						this.logger.info("job.check-dns.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "email",
						});
					}

					if (alert.config.strategy === "webhook") {
						let payload = {
							type: "dns_change",
							monitor: {
								id: monitor.id,
								name: monitor.name,
								domain: monitor.domain,
								recordType: monitor.recordType,
							},
							result: {
								status: result.status,
								resolvedValue: result.resolvedValue,
								errorMessage: result.errorMessage,
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

						this.logger.info("job.check-dns.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "webhook",
						});
					}

					if (alert.config.strategy === "slack") {
						let message = this.getSlackMessage(monitor, result);

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

						this.logger.info("job.check-dns.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "slack",
						});
					}

					if (alert.config.strategy === "discord") {
						let message = this.getDiscordMessage(monitor, result);

						let response = await fetch(alert.config.config.webhookUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ content: message }),
						});

						if (!response.ok) {
							throw new Error(`Discord webhook failed with status ${response.status}`);
						}

						this.logger.info("job.check-dns.alert-sent", {
							monitorId: monitor.id,
							alertId: alert.id,
							alertType: "discord",
						});
					}

					await recordAlertEvent(this.db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: "sent",
						sentAt,
						monitorType: "dns",
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
						monitorType: "dns",
						monitorName: monitor.name,
						snapshot,
					});
					throw error;
				}
			}),
		);

		let failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			this.logger.error("job.check-dns.some-alerts-failed", {
				monitorId: monitor.id,
				failedCount: failed.length,
				totalCount: results.length,
			});
		}
	}

	private getEmailSubject(status: string, monitorName: string, subjectPrefix?: string): string {
		let prefix = subjectPrefix ?? "[DNS ALERT]";

		if (status === "error") {
			return `${prefix} DNS check ERROR for ${monitorName}`;
		}

		return `${prefix} DNS record CHANGED for ${monitorName}`;
	}

	private getEmailBody(
		monitor: { name: string; domain: string; recordType: string; team: { id: string } },
		result: { status: string; resolvedValue: string | null; errorMessage?: string },
	): string {
		let statusMessage =
			result.status === "error"
				? `DNS check for ${monitor.name} failed with an error.`
				: `The DNS ${monitor.recordType} record for ${monitor.domain} has changed.`;

		let url = `https://uptime.sergiodxa.com/app/${monitor.team.id}/dns/${monitor.domain}`;

		let body = `${statusMessage}

Monitor: ${monitor.name}
Domain: ${monitor.domain}
Record Type: ${monitor.recordType}
`;

		if (result.resolvedValue) {
			body += `Current Value: ${result.resolvedValue}\n`;
		}

		if (result.errorMessage) {
			body += `Error: ${result.errorMessage}\n`;
		}

		body += `\nView monitor: ${url}`;

		return body;
	}

	private getSlackMessage(
		monitor: { name: string; domain: string; recordType: string },
		result: { status: string; resolvedValue: string | null; errorMessage?: string },
	): string {
		let emoji = result.status === "error" ? ":x:" : ":warning:";
		let statusText = result.status === "error" ? "ERROR" : "CHANGED";

		let message = `${emoji} *DNS ${statusText}*: ${monitor.name}\n`;
		message += `Domain: \`${monitor.domain}\` (${monitor.recordType})\n`;

		if (result.resolvedValue) {
			message += `Current Value: \`${result.resolvedValue}\`\n`;
		}

		if (result.errorMessage) {
			message += `Error: ${result.errorMessage}\n`;
		}

		return message;
	}

	private getDiscordMessage(
		monitor: { name: string; domain: string; recordType: string },
		result: { status: string; resolvedValue: string | null; errorMessage?: string },
	): string {
		let statusText = result.status === "error" ? "ERROR" : "CHANGED";

		let message = `**DNS ${statusText}**: ${monitor.name}\n`;
		message += `Domain: \`${monitor.domain}\` (${monitor.recordType})\n`;

		if (result.resolvedValue) {
			message += `Current Value: \`${result.resolvedValue}\`\n`;
		}

		if (result.errorMessage) {
			message += `Error: ${result.errorMessage}\n`;
		}

		return message;
	}
}
