import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import { BatchedLogger } from "@pkg/logger";
import { isFailure } from "@pkg/result";
import { env, WorkflowEntrypoint } from "cloudflare:workers";

import { getLatestStatusFromAnalytics } from "~/services/analytics.server";

const MILLISECONDS_PER_SECOND = 1000;

export default class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	private async getDb() {
		let database = await import("~/db/index").then((m) => m.default);
		return database(env.DB);
	}

	override async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
		let monitorResultId = event.instanceId;
		let logger = new BatchedLogger(`workflow:ping:${monitorResultId}`);

		try {
			await this.execute(event, step, logger);
		} catch (error) {
			logger.error("workflow.ping.error", {
				monitorResultId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			logger.flush();
		}
	}

	private async execute(event: WorkflowEvent<unknown>, step: WorkflowStep, logger: BatchedLogger) {
		let monitorResultId = event.instanceId;

		logger.info("workflow.ping.started", { monitorResultId });

		let db = await this.getDb();

		let monitorResult = await step.do("find monitor by result id", async () => {
			logger.info("workflow.ping.step.find-monitor-result.start", { monitorResultId });
			let result = await db.query.monitorResults.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, monitorResultId);
				},
				with: {
					monitor: {
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
					},
				},
			});
			logger.info("workflow.ping.step.find-monitor-result.complete", {
				monitorResultId,
				found: !!result,
			});
			return result;
		});

		if (!monitorResult) {
			logger.error("workflow.ping.monitor-result-not-found", { monitorResultId });
			throw new Error(`Monitor result ${monitorResultId} not found`);
		}

		logger.info("workflow.ping.monitor-found", {
			monitorId: monitorResult.monitor.id,
			teamId: monitorResult.monitor.team.id,
			method: monitorResult.monitor.method,
			expectedStatus: monitorResult.monitor.expectedStatus,
			timeoutSeconds: monitorResult.monitor.timeoutSeconds,
			locationHint: monitorResult.monitor.locationHint,
			contentChecksCount: monitorResult.monitor.contentChecks.length,
		});

		let previousStatusFromAe = await step.do("get previous status from AE", async () => {
			let latest = await getLatestStatusFromAnalytics({
				teamId: monitorResult.monitor.team.id,
				monitorId: monitorResult.monitor.id,
				monitorType: "http",
			});

			if (isFailure(latest)) {
				logger.error("workflow.ping.previous-status.ae-error", {
					monitorId: monitorResult.monitor.id,
					error: latest.error.message,
				});
				return null;
			}

			return latest.data;
		});

		let hasContentChecks = monitorResult.monitor.contentChecks.length > 0;

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
				timeout: monitorResult.monitor.timeoutSeconds * MILLISECONDS_PER_SECOND,
			},
			async () => {
				logger.info("workflow.ping.step.ping-monitor.start", {
					monitorId: monitorResult.monitor.id,
					url: monitorResult.monitor.url,
					method: monitorResult.monitor.method,
					locationHint: monitorResult.monitor.locationHint,
				});
				let id = env.GEO_FETCH.idFromName(monitorResult.monitor.locationHint);

				// Support GDPR and non-GDPR regions
				// If the location hint is "eeur" or "enam", use the EU jurisdiction
				let isEurope =
					monitorResult.monitor.locationHint === "eeur" ||
					monitorResult.monitor.locationHint === "enam";

				let geo = isEurope
					? env.GEO_FETCH.jurisdiction("eu").get(id, {
							locationHint: monitorResult.monitor.locationHint,
						})
					: env.GEO_FETCH.get(id, {
							locationHint: monitorResult.monitor.locationHint,
						});

				let { url, method } = monitorResult.monitor;
				let signal = AbortSignal.timeout(
					monitorResult.monitor.timeoutSeconds * MILLISECONDS_PER_SECOND,
				);

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
					monitorId: monitorResult.monitor.id,
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
			expectedStatus: monitorResult.monitor.expectedStatus,
			isSuccess: result.responseStatus === monitorResult.monitor.expectedStatus,
		});

		// Run content checks if there are any
		let contentCheckResult = await step.do("run content checks", async () => {
			logger.info("workflow.ping.step.content-checks.start", {
				monitorId: monitorResult.monitor.id,
				hasContentChecks,
				checksCount: monitorResult.monitor.contentChecks.length,
			});

			if (!hasContentChecks) {
				logger.info("workflow.ping.step.content-checks.complete", {
					monitorId: monitorResult.monitor.id,
					skipped: true,
				});
				return { allPassed: true, failedCount: 0 };
			}

			let { checkContentRules } = await import("~/services/check-content");
			let summary = checkContentRules(
				result.responseBody ?? "",
				monitorResult.monitor.contentChecks,
			);

			logger.info("workflow.ping.step.content-checks.complete", {
				monitorId: monitorResult.monitor.id,
				allPassed: summary.allPassed,
				failedCount: summary.failedCount,
				totalChecks: monitorResult.monitor.contentChecks.length,
			});

			return {
				allPassed: summary.allPassed,
				failedCount: summary.failedCount,
				results: summary.results,
			};
		});

		let disableD1Results = env.DISABLE_D1_RESULTS !== "false";

		let updatedMonitorResult = await step.do("save monitor results", async () => {
			if (disableD1Results) {
				logger.info("workflow.ping.step.save-results.skipped-d1", {
					monitorResultId,
					monitorId: monitorResult.monitor.id,
				});
				return {
					...monitorResult,
					responseStatus: result.responseStatus,
					responseTimeMs: result.responseTimeMs,
					completedAt: result.completedAt,
				};
			}

			let { eq: eqOp } = await import("drizzle-orm");
			let schema = await import("~/db/schema");
			let db = await this.getDb();

			let [updatedMonitorResult] = await db
				.update(schema.monitorResults)
				.set({
					responseStatus: result.responseStatus,
					responseTimeMs: result.responseTimeMs,
					completedAt: result.completedAt,
				})
				.where(eqOp(schema.monitorResults.id, monitorResult.id))
				.returning();

			if (updatedMonitorResult) {
				logger.info("workflow.ping.step.save-results.complete", {
					monitorResultId,
					monitorId: monitorResult.monitor.id,
					responseStatus: updatedMonitorResult.responseStatus,
					responseTimeMs: updatedMonitorResult.responseTimeMs,
				});
				return updatedMonitorResult;
			}
			throw new Error("Failed to update monitor result");
		});

		await step.do("write to analytics engine", async () => {
			logger.info("workflow.ping.step.write-analytics.start", {
				monitorResultId,
				monitorId: monitorResult.monitor.id,
			});

			let { writePingResult } = await import("~/services/analytics.server");

			// Determine status: up if matches expected AND content checks pass, otherwise down
			let statusMatches = result.responseStatus === monitorResult.monitor.expectedStatus;
			let contentChecksPassed = contentCheckResult.allPassed;
			let status: "up" | "down" = statusMatches && contentChecksPassed ? "up" : "down";

			writePingResult({
				monitorId: monitorResult.monitor.id,
				monitorType: "http",
				status,
				responseTimeMs: result.responseTimeMs,
				teamId: monitorResult.monitor.team.id,
				responseStatus: result.responseStatus,
				expectedStatus: monitorResult.monitor.expectedStatus,
			});

			logger.info("workflow.ping.step.write-analytics.complete", {
				monitorResultId,
				monitorId: monitorResult.monitor.id,
				status,
			});
		});

		await step.do("send alerts", async () => {
			logger.info("workflow.ping.step.send-alerts.start", { monitorId: monitorResult.monitor.id });

			// Status check passes if response status matches expected AND content checks pass
			let statusMatches =
				updatedMonitorResult.responseStatus === monitorResult.monitor.expectedStatus;
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
				downtimeDurationMs = updatedMonitorResult.completedAt!.getTime() - prevTs;
			}

			// Skip if monitor is up and it's not a recovery
			if (currentStatus === "up" && !isRecovery) return;

			// At this point, we either have a recovery (status will be "recovered") or the monitor is down
			let alertStatus: "down" | "recovered" | "degraded" = isRecovery ? "recovered" : "down";
			let eventType: "down" | "up" | "degraded" = isRecovery ? "up" : "down";

			let db = await this.getDb();

			// Check for active maintenance window
			let { checkMonitorMaintenance } = await import("~/services/check-maintenance");
			let maintenanceStatus = await checkMonitorMaintenance(
				db,
				monitorResult.monitor.id,
				monitorResult.monitor.team.id,
			);

			// Skip alerts if in maintenance with suppressAlerts enabled
			if (maintenanceStatus.isInMaintenance && maintenanceStatus.suppressAlerts) {
				return;
			}

			let alerts = await db.query.alerts.findMany({
				where(fields, operators) {
					return operators.or(
						operators.eq(fields.teamId, monitorResult.monitor.team.id),
						operators.and(
							operators.eq(fields.teamId, monitorResult.monitor.team.id),
							operators.eq(fields.monitorId, monitorResult.monitor.id),
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
					monitorId: monitorResult.monitor.id,
					team: monitorResult.monitor.team.id,
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
						monitorResult.monitor.id,
						eventType,
						alert.cooldownMinutes,
					);

					if (cooldownCheck.isInCooldown) {
						// Record skipped alert event
						await recordAlertEvent(db, {
							alertId: alert.id,
							monitorId: monitorResult.monitor.id,
							eventType,
							status: "skipped_cooldown",
							sentAt: now,
							monitorType: "http",
							monitorName: monitorResult.monitor.name,
							snapshot: {
								type: "http",
								responseStatus: result.responseStatus,
								responseTimeMs: result.responseTimeMs,
								expectedStatus: monitorResult.monitor.expectedStatus,
								url: monitorResult.monitor.url,
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
									monitorResult.monitor.name,
									alert.config.config.subjectPrefix,
								),
								text: await this.emailBody(
									isRecovery ? "recovered" : currentStatus,
									monitorResult.monitor,
									isRecovery
										? { recoveryTime: updatedMonitorResult.completedAt!, downtimeDurationMs }
										: undefined,
								),
							});
						} else if (alert.config.strategy === "slack") {
							await sendSlackAlert({
								webhookUrl: alert.config.config.webhookUrl,
								channel: alert.config.config.channel,
								monitor: monitorResult.monitor,
								status: alertStatus,
								timestamp: updatedMonitorResult.completedAt!,
								dashboardUrl,
								recoveryInfo: isRecovery ? { downtimeDurationMs } : undefined,
							});
						} else if (alert.config.strategy === "discord") {
							await sendDiscordAlert({
								webhookUrl: alert.config.config.webhookUrl,
								monitor: monitorResult.monitor,
								status: alertStatus,
								timestamp: updatedMonitorResult.completedAt!,
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
						monitorId: monitorResult.monitor.id,
						eventType,
						status: sendError ? "failed" : "sent",
						sentAt: now,
						errorMessage: sendError,
						monitorType: "http",
						monitorName: monitorResult.monitor.name,
						snapshot: {
							type: "http",
							responseStatus: result.responseStatus,
							responseTimeMs: result.responseTimeMs,
							expectedStatus: monitorResult.monitor.expectedStatus,
							url: monitorResult.monitor.url,
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
				monitorId: monitorResult.monitor.id,
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
				monitorId: monitorResult.monitor.id,
				teamId: monitorResult.monitor.team.id,
				ownerId: monitorResult.monitor.team.ownerId,
			});

			const Customer = await import("~/models/customer").then((m) => m.default);
			let result = await Customer.ingest(monitorResult.monitor.team.ownerId, {
				monitorId: monitorResult.monitor.id,
				resultId: monitorResult.id,
				teamId: monitorResult.monitor.team.id,
			});

			logger.info("workflow.ping.step.ingest-usage.complete", {
				monitorId: monitorResult.monitor.id,
				teamId: monitorResult.monitor.team.id,
			});

			return result;
		});

		logger.info("workflow.ping.completed", {
			monitorResultId,
			monitorId: monitorResult.monitor.id,
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
