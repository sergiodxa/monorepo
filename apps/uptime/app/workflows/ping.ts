/**
 * The Cloudflare Workflow that runs a single HTTP monitor check end to end. It loads the
 * monitor, performs a region-hinted fetch, evaluates the expected status and any content
 * checks, writes the result to Analytics Engine, dispatches down/recovery alerts (email,
 * Slack, Discord) while respecting cooldowns and maintenance windows, and ingests usage.
 * It exists to reliably orchestrate these steps with retries so pings survive failures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import { BatchedLogger } from "@pkg/logger";
import { isFailure } from "@pkg/result";
import { env, WorkflowEntrypoint } from "cloudflare:workers";

const MILLISECONDS_PER_SECOND = 1000;

export namespace Ping {
	export interface WorkflowParams {
		monitorId: string;
	}
}

export class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	private async getDb() {
		let database = await import("~/db/index").then((m) => m.default);
		return database(env.DB);
	}

	override async run(event: WorkflowEvent<Ping.WorkflowParams>, step: WorkflowStep) {
		let { monitorId } = event.payload;
		let instanceId = event.instanceId;
		let logger = new BatchedLogger(`workflow:ping:${instanceId}`);

		try {
			await this.execute(event, step, logger);
		} catch (error) {
			logger.error("workflow.ping.error", {
				instanceId,
				monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			logger.flush();
		}
	}

	private async execute(
		event: WorkflowEvent<Ping.WorkflowParams>,
		step: WorkflowStep,
		logger: BatchedLogger,
	) {
		let { monitorId } = event.payload;
		let instanceId = event.instanceId;

		logger.info("workflow.ping.started", { instanceId, monitorId });

		let db = await this.getDb();

		let monitor = await step.do("find monitor by id", async () => {
			logger.info("workflow.ping.step.find-monitor.start", { monitorId });
			let result = await db.query.monitors.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, monitorId);
				},
				columns: {
					id: true,
					name: true,
					url: true,
					method: true,
					locationHint: true,
					expectedStatus: true,
					timeoutSeconds: true,
				},
				with: {
					team: {
						columns: { id: true, ownerId: true },
					},
					contentChecks: {
						where(fields, operators) {
							return operators.eq(fields.isEnabled, true);
						},
						columns: {
							id: true,
							type: true,
							value: true,
							caseSensitive: true,
						},
					},
				},
			});
			logger.info("workflow.ping.step.find-monitor.complete", {
				monitorId,
				found: !!result,
			});
			return result;
		});

		if (!monitor) {
			// Monitor was deleted before workflow could run - exit gracefully
			logger.info("workflow.ping.monitor-not-found", { monitorId });
			return;
		}

		logger.info("workflow.ping.monitor-found", {
			monitorId: monitor.id,
			teamId: monitor.team.id,
			method: monitor.method,
			expectedStatus: monitor.expectedStatus,
			timeoutSeconds: monitor.timeoutSeconds,
			locationHint: monitor.locationHint,
			contentChecksCount: monitor.contentChecks.length,
		});

		let previousStatusFromAe = await step.do("get previous status from AE", async () => {
			let { getLatestStatusFromAnalytics } = await import("~/services/analytics.server");

			let latest = await getLatestStatusFromAnalytics({
				teamId: monitor.team.id,
				monitorId: monitor.id,
				monitorType: "http",
			});

			if (isFailure(latest)) {
				logger.error("workflow.ping.previous-status.ae-error", {
					monitorId: monitor.id,
					error: latest.error.message,
				});
				return null;
			}

			return latest.data;
		});

		let hasContentChecks = monitor.contentChecks.length > 0;

		logger.info("workflow.ping.previous-result", {
			hasPrevious: !!previousStatusFromAe?.status,
			previousStatus: previousStatusFromAe?.status ?? null,
			previousTimestamp: previousStatusFromAe?.timestamp ?? null,
		});

		let result = await step.do(
			"ping monitor",
			{
				retries: {
					limit: 3,
					delay: 1000, // Delay in milliseconds between retries
					backoff: "exponential", // Exponential backoff strategy
				},
				timeout: monitor.timeoutSeconds * MILLISECONDS_PER_SECOND,
			},
			async () => {
				logger.info("workflow.ping.step.ping-monitor.start", {
					monitorId: monitor.id,
					url: monitor.url,
					method: monitor.method,
					locationHint: monitor.locationHint,
				});
				let id = env.GEO_FETCH.idFromName(monitor.locationHint);

				// Support GDPR and non-GDPR regions
				// If the location hint is "eeur" or "enam", use the EU jurisdiction
				let isEurope = monitor.locationHint === "eeur" || monitor.locationHint === "enam";

				let geo = isEurope
					? env.GEO_FETCH.jurisdiction("eu").get(id, {
							locationHint: monitor.locationHint,
						})
					: env.GEO_FETCH.get(id, {
							locationHint: monitor.locationHint,
						});

				let { url, method } = monitor;
				let signal = AbortSignal.timeout(monitor.timeoutSeconds * MILLISECONDS_PER_SECOND);

				// If there are content checks and method is HEAD, switch to GET to retrieve body
				let effectiveMethod = hasContentChecks && method === "HEAD" ? "GET" : method;

				let response = await geo.fetch(url, { method: effectiveMethod, signal });

				// Get response body for content checks
				let responseBody: string | null = null;
				if (hasContentChecks) {
					try {
						responseBody = await response.text();
					} catch {
						responseBody = null;
					}
				}

				logger.info("workflow.ping.step.ping-monitor.complete", {
					monitorId: monitor.id,
					responseStatus: response.status,
					responseTimeMs: Number(response.headers.get("X-Response-Time")),
				});

				return {
					responseStatus: response.status,
					responseTimeMs: Number(response.headers.get("X-Response-Time")),
					completedAt: new Date(),
					responseBody,
				};
			},
		);

		logger.info("workflow.ping.ping-completed", {
			responseStatus: result.responseStatus,
			responseTimeMs: result.responseTimeMs,
			expectedStatus: monitor.expectedStatus,
			isSuccess: result.responseStatus === monitor.expectedStatus,
		});

		// Run content checks if there are any
		let contentCheckResult = await step.do("run content checks", async () => {
			logger.info("workflow.ping.step.content-checks.start", {
				monitorId: monitor.id,
				hasContentChecks,
				checksCount: monitor.contentChecks.length,
			});

			if (!hasContentChecks) {
				logger.info("workflow.ping.step.content-checks.complete", {
					monitorId: monitor.id,
					skipped: true,
				});
				return { allPassed: true, failedCount: 0 };
			}

			let { checkContentRules } = await import("~/services/check-content");
			let summary = checkContentRules(result.responseBody ?? "", monitor.contentChecks);

			logger.info("workflow.ping.step.content-checks.complete", {
				monitorId: monitor.id,
				allPassed: summary.allPassed,
				failedCount: summary.failedCount,
				totalChecks: monitor.contentChecks.length,
			});

			return {
				allPassed: summary.allPassed,
				failedCount: summary.failedCount,
				results: summary.results,
			};
		});

		let pingResult = await step.do("prepare ping result", async () => {
			logger.info("workflow.ping.step.prepare-result", {
				instanceId,
				monitorId: monitor.id,
			});
			return {
				responseStatus: result.responseStatus,
				responseTimeMs: result.responseTimeMs,
				completedAt: result.completedAt,
			};
		});

		await step.do("write to analytics engine", async () => {
			logger.info("workflow.ping.step.write-analytics.start", {
				instanceId,
				monitorId: monitor.id,
			});

			let { writePingResult } = await import("~/services/analytics.server");

			// Determine status: up if matches expected AND content checks pass, otherwise down
			let statusMatches = result.responseStatus === monitor.expectedStatus;
			let contentChecksPassed = contentCheckResult.allPassed;
			let status: "up" | "down" = statusMatches && contentChecksPassed ? "up" : "down";

			writePingResult({
				monitorId: monitor.id,
				monitorType: "http",
				status,
				responseTimeMs: result.responseTimeMs,
				teamId: monitor.team.id,
				responseStatus: result.responseStatus,
				expectedStatus: monitor.expectedStatus,
			});

			logger.info("workflow.ping.step.write-analytics.complete", {
				instanceId,
				monitorId: monitor.id,
				status,
			});
		});

		await step.do("send alerts", async () => {
			logger.info("workflow.ping.step.send-alerts.start", { monitorId: monitor.id });

			// Status check passes if response status matches expected AND content checks pass
			let statusMatches = pingResult.responseStatus === monitor.expectedStatus;
			let contentChecksPassed = contentCheckResult.allPassed;

			let currentStatus: "up" | "down" = statusMatches && contentChecksPassed ? "up" : "down";

			// Determine the previous status (null if no previous result)
			let previousStatus: "up" | "down" | null = null;
			if (previousStatusFromAe?.status) {
				previousStatus = previousStatusFromAe.status === "up" ? "up" : "down";
			}

			// Determine if this is a recovery (DOWN -> UP transition)
			let isRecovery = previousStatus === "down" && currentStatus === "up";

			// Calculate downtime duration for recovery alerts
			let downtimeDurationMs: number | null = null;
			if (isRecovery && previousStatusFromAe?.timestamp) {
				let prevTs = new Date(previousStatusFromAe.timestamp).getTime();
				downtimeDurationMs = pingResult.completedAt!.getTime() - prevTs;
			}

			// Skip if monitor is up and it's not a recovery
			if (currentStatus === "up" && !isRecovery) return;

			// At this point, we either have a recovery (status will be "recovered") or the monitor is down
			let alertStatus: "down" | "recovered" | "degraded" = isRecovery ? "recovered" : "down";
			let eventType: "down" | "up" | "degraded" = isRecovery ? "up" : "down";

			let db = await this.getDb();

			// Check for active maintenance window
			let { checkMonitorMaintenance } = await import("~/services/check-maintenance");
			let maintenanceStatus = await checkMonitorMaintenance(db, monitor.id, monitor.team.id);

			// Skip alerts if in maintenance with suppressAlerts enabled
			if (maintenanceStatus.isInMaintenance && maintenanceStatus.suppressAlerts) {
				return;
			}

			let alerts = await db.query.alerts.findMany({
				where(fields, operators) {
					return operators.or(
						operators.eq(fields.teamId, monitor.team.id),
						operators.and(
							operators.eq(fields.teamId, monitor.team.id),
							operators.eq(fields.monitorId, monitor.id),
						),
					);
				},
			});

			let resend = await import("~/clients/resend").then((m) => m.default);
			let { sendSlackAlert } = await import("~/services/send-slack-alert");
			let { sendDiscordAlert } = await import("~/services/send-discord-alert");
			let { checkAlertCooldown, recordAlertEvent } = await import("~/services/alert-cooldown");
			let { href } = await import("react-router");

			let dashboardUrl = new URL(
				href("/app/:team/monitors/:monitorId", {
					monitorId: monitor.id,
					team: monitor.team.id,
				}),
				"https://uptime.sergiodxa.com",
			).toString();

			let now = new Date();

			let results = await Promise.allSettled(
				alerts.map(async (alert) => {
					// Skip recovery alerts if notifyOnRecovery is false
					if (isRecovery && !alert.notifyOnRecovery) return;

					// Check if alert is within cooldown period
					let cooldownCheck = await checkAlertCooldown(
						db,
						alert.id,
						monitor.id,
						eventType,
						alert.cooldownMinutes,
					);

					if (cooldownCheck.isInCooldown) {
						// Record skipped alert event
						await recordAlertEvent(db, {
							alertId: alert.id,
							monitorId: monitor.id,
							eventType,
							status: "skipped_cooldown",
							sentAt: now,
							monitorType: "http",
							monitorName: monitor.name,
							snapshot: {
								type: "http",
								responseStatus: result.responseStatus,
								responseTimeMs: result.responseTimeMs,
								expectedStatus: monitor.expectedStatus,
								url: monitor.url,
							},
						});
						return;
					}

					let sendError: string | null = null;

					try {
						if (alert.config.strategy === "email") {
							await resend.emails.send({
								to: alert.config.config.to,
								from: "Uptime <no-reply@uptime.sergiodxa.com>",
								replyTo: "hello@sergiodxa.com",
								subject: this.emailSubject(
									isRecovery ? "recovered" : currentStatus,
									monitor.name,
									alert.config.config.subjectPrefix,
								),
								text: await this.emailBody(
									isRecovery ? "recovered" : currentStatus,
									monitor,
									isRecovery
										? { recoveryTime: pingResult.completedAt!, downtimeDurationMs }
										: undefined,
								),
							});
						} else if (alert.config.strategy === "slack") {
							await sendSlackAlert({
								webhookUrl: alert.config.config.webhookUrl,
								channel: alert.config.config.channel,
								monitor: monitor,
								status: alertStatus,
								timestamp: pingResult.completedAt!,
								dashboardUrl,
								recoveryInfo: isRecovery ? { downtimeDurationMs } : undefined,
							});
						} else if (alert.config.strategy === "discord") {
							await sendDiscordAlert({
								webhookUrl: alert.config.config.webhookUrl,
								monitor: monitor,
								status: alertStatus,
								timestamp: pingResult.completedAt!,
								dashboardUrl,
								recoveryInfo: isRecovery ? { downtimeDurationMs } : undefined,
							});
						}
					} catch (error) {
						sendError = error instanceof Error ? error.message : String(error);
					}

					// Record alert event (sent or failed)
					await recordAlertEvent(db, {
						alertId: alert.id,
						monitorId: monitor.id,
						eventType,
						status: sendError ? "failed" : "sent",
						sentAt: now,
						errorMessage: sendError,
						monitorType: "http",
						monitorName: monitor.name,
						snapshot: {
							type: "http",
							responseStatus: result.responseStatus,
							responseTimeMs: result.responseTimeMs,
							expectedStatus: monitor.expectedStatus,
							url: monitor.url,
						},
					});

					// Re-throw error after recording to maintain original behavior
					if (sendError) {
						throw new Error(sendError);
					}
				}),
			);

			let successCount = results.filter((r) => r.status === "fulfilled").length;
			let failedCount = results.filter((r) => r.status === "rejected").length;

			logger.info("workflow.ping.step.send-alerts.complete", {
				monitorId: monitor.id,
				alertsTotal: alerts.length,
				alertsSent: successCount,
				alertsFailed: failedCount,
				currentStatus,
				isRecovery,
			});

			if (results.every((alert) => alert.status === "rejected")) {
				throw new AggregateError(
					results.filter((r) => r.status === "rejected").map((r) => r.reason),
					"Failed to send every alert",
				);
			}
		});

		await step.do("ingest usage", async () => {
			logger.info("workflow.ping.step.ingest-usage.start", {
				monitorId: monitor.id,
				teamId: monitor.team.id,
				ownerId: monitor.team.ownerId,
			});

			const Customer = await import("~/models/customer").then((m) => m.default);
			let ingestResult = await Customer.ingest(monitor.team.ownerId, {
				monitorId: monitor.id,
				instanceId: instanceId,
				teamId: monitor.team.id,
			});

			logger.info("workflow.ping.step.ingest-usage.complete", {
				monitorId: monitor.id,
				teamId: monitor.team.id,
			});

			return ingestResult;
		});

		logger.info("workflow.ping.completed", {
			instanceId,
			monitorId: monitor.id,
			responseStatus: result.responseStatus,
		});
	}

	private emailSubject(status: string, monitorName: string, subjectPrefix?: string): string {
		let prefix = subjectPrefix ?? `[${status.toUpperCase()}]`;
		return `${prefix} - Monitor ${monitorName} is ${status}`;
	}

	private async emailBody(
		status: string,
		monitor: { name: string; id: string; team: { id: string } },
		recoveryInfo?: { recoveryTime: Date; downtimeDurationMs: number | null },
	): Promise<string> {
		let { href } = await import("react-router");
		let url = new URL(
			href("/app/:team/monitors/:monitorId", {
				monitorId: monitor.id,
				team: monitor.team.id,
			}),
			"https://uptime.sergiodxa.com",
		);

		let body = `Monitor ${monitor.name} is ${status.toUpperCase()}.\n\n`;

		if (recoveryInfo) {
			body += `Recovery time: ${recoveryInfo.recoveryTime.toISOString()}\n`;
			if (recoveryInfo.downtimeDurationMs !== null) {
				body += `Downtime duration: ${this.formatDuration(recoveryInfo.downtimeDurationMs)}\n`;
			}
			body += "\n";
		}

		body += `Check it out at ${url.toString()}`;

		return body;
	}

	private formatDuration(ms: number): string {
		let seconds = Math.floor(ms / 1000);
		let minutes = Math.floor(seconds / 60);
		let hours = Math.floor(minutes / 60);

		if (hours > 0) {
			let remainingMinutes = minutes % 60;
			return `${hours}h ${remainingMinutes}m`;
		}
		if (minutes > 0) {
			let remainingSeconds = seconds % 60;
			return `${minutes}m ${remainingSeconds}s`;
		}
		return `${seconds}s`;
	}
}
