import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import { env, WorkflowEntrypoint } from "cloudflare:workers";

const MILLISECONDS_PER_SECOND = 1000;

export default class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	private async getDb() {
		let database = await import("~/db/index").then((m) => m.default);
		return database(env.DB);
	}

	override async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
		let db = await this.getDb();

		let monitorResultId = event.instanceId;

		let monitorResult = await step.do("find monitor by result id", () => {
			return db.query.monitorResults.findFirst({
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
		});

		if (!monitorResult) {
			throw new Error(`Monitor result ${monitorResultId} not found`);
		}

		// Get the previous completed result to detect state transitions
		let previousResult = await step.do("find previous result", async () => {
			let { and, eq, isNotNull, lt, desc } = await import("drizzle-orm");
			let schema = await import("~/db/schema");
			let db = await this.getDb();

			let results = await db
				.select()
				.from(schema.monitorResults)
				.where(
					and(
						eq(schema.monitorResults.monitorId, monitorResult.monitor.id),
						lt(schema.monitorResults.createdAt, monitorResult.createdAt),
						isNotNull(schema.monitorResults.completedAt),
					),
				)
				.orderBy(desc(schema.monitorResults.createdAt))
				.limit(1);

			return results[0] ?? null;
		});

		let hasContentChecks = monitorResult.monitor.contentChecks.length > 0;

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

				return {
					responseStatus: response.status,
					responseTimeMs: Number(response.headers.get("X-Response-Time")),
					completedAt: new Date(),
					responseBody,
				};
			},
		);

		// Run content checks if there are any
		let contentCheckResult = await step.do("run content checks", async () => {
			if (!hasContentChecks) {
				return { allPassed: true, failedCount: 0 };
			}

			let { checkContentRules } = await import("~/services/check-content");
			let summary = checkContentRules(
				result.responseBody ?? "",
				monitorResult.monitor.contentChecks,
			);

			return {
				allPassed: summary.allPassed,
				failedCount: summary.failedCount,
				results: summary.results,
			};
		});

		let updatedMonitorResult = await step.do("save monitor results", async () => {
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
			if (updatedMonitorResult) return updatedMonitorResult;
			throw new Error("Failed to update monitor result");
		});

		await step.do("send alerts", async () => {
			// Status check passes if response status matches expected AND content checks pass
			let statusMatches =
				updatedMonitorResult.responseStatus === monitorResult.monitor.expectedStatus;
			let contentChecksPassed = contentCheckResult.allPassed;

			let currentStatus: "up" | "down" = statusMatches && contentChecksPassed ? "up" : "down";

			// Determine the previous status (null if no previous result)
			let previousStatus: "up" | "down" | null = null;
			if (previousResult) {
				previousStatus =
					previousResult.responseStatus === monitorResult.monitor.expectedStatus ? "up" : "down";
			}

			// Determine if this is a recovery (DOWN -> UP transition)
			let isRecovery = previousStatus === "down" && currentStatus === "up";

			// Calculate downtime duration for recovery alerts
			let downtimeDurationMs: number | null = null;
			if (isRecovery && previousResult?.completedAt) {
				downtimeDurationMs =
					updatedMonitorResult.completedAt!.getTime() - previousResult.completedAt.getTime();
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
				"https://ping.sergiodxa.com",
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
						});
						return;
					}

					let sendError: string | null = null;

					try {
						if (alert.config.strategy === "email") {
							await resend.emails.send({
								to: alert.config.config.to,
								from: "Uptime <no-reply@ping.sergiodxa.com>",
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
					});

					// Re-throw error after recording to maintain original behavior
					if (sendError) {
						throw new Error(sendError);
					}
				}),
			);

			if (results.every((alert) => alert.status === "rejected")) {
				throw new AggregateError(
					results.filter((r) => r.status === "rejected").map((r) => r.reason),
					"Failed to send every alert",
				);
			}
		});

		await step.do("ingest usage", async () => {
			const Customer = await import("~/models/customer").then((m) => m.default);
			return Customer.ingest(monitorResult.monitor.team.ownerId, {
				monitorId: monitorResult.monitor.id,
				resultId: monitorResult.id,
				teamId: monitorResult.monitor.team.id,
			});
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
			"https://ping.sergiodxa.com",
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
