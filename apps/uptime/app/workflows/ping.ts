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
						},
					},
				},
			});
		});

		if (!monitorResult) {
			throw new Error(`Monitor result ${monitorResultId} not found`);
		}

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

				let response = await geo.fetch(url, { method, signal });

				return {
					responseStatus: response.status,
					responseTimeMs: Number(response.headers.get("X-Response-Time")),
					completedAt: new Date(),
				};
			},
		);

		let updatedMonitorResult = await step.do("save monitor results", async () => {
			let { eq: eqOp } = await import("drizzle-orm");
			let schema = await import("~/db/schema");
			let db = await this.getDb();

			let [updatedMonitorResult] = await db
				.update(schema.monitorResults)
				.set(result)
				.where(eqOp(schema.monitorResults.id, monitorResult.id))
				.returning();
			if (updatedMonitorResult) return updatedMonitorResult;
			throw new Error("Failed to update monitor result");
		});

		await step.do("send alerts", async () => {
			let status =
				updatedMonitorResult.responseStatus === monitorResult.monitor.expectedStatus
					? "up"
					: "down";

			if (status === "up") return;

			let db = await this.getDb();
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
			let results = await Promise.allSettled(
				alerts.map(async (alert) => {
					if (alert.config.strategy === "email") {
						await resend.emails.send({
							to: alert.config.config.to,
							from: "Uptime <no-reply@ping.sergiodxa.com>",
							replyTo: "hello@sergiodxa.com",
							subject: this.emailSubject(
								status,
								monitorResult.monitor.name,
								alert.config.config.subjectPrefix,
							),
							text: await this.emailBody(status, monitorResult.monitor),
						});
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
	): Promise<string> {
		let { href } = await import("react-router");
		let url = new URL(
			href("/app/:team/monitors/:monitorId", {
				monitorId: monitor.id,
				team: monitor.team.id,
			}),
			"https://ping.sergiodxa.com",
		);

		return (
			`Monitor ${monitor.name} is ${status.toUpperCase()}.\n\n` +
			`Check it out at ${url.toString()}`
		);
	}
}
