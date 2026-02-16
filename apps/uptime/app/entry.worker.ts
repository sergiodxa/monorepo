import type { JSONValue } from "@pkg/types";
import type { RequestHandler } from "react-router";

import { env, waitUntil } from "cloudflare:workers";

import GeoFetchDO from "./do/geo-fetch";
import Ping from "./workflows/ping";

let handler: RequestHandler;

export { Ping, GeoFetchDO };

export default {
	async fetch(request) {
		let build = await import("virtual:react-router/server-build");

		let { createRequestHandler, RouterContextProvider } = await import("react-router");

		if (!handler) handler = createRequestHandler(build, import.meta.env.MODE);

		let context = new RouterContextProvider();
		return await handler(request, context);
	},

	async scheduled(controller) {
		// Every minute
		if (controller.cron === "* * * * *") {
			let database = await import("../db").then((m) => m.default);
			let Monitor = await import("./models/monitor").then((m) => m.default);
			let db = database(env.DB);
			let scheduledDate = new Date(controller.scheduledTime);
			waitUntil(Monitor.pingLater(db, scheduledDate));

			// Check cron job monitors
			waitUntil(env.QUEUE.send({ type: "checkCronJobs" }));
		}

		// Every 10 minutes
		if (controller.cron === "*/10 * * * *") {
			waitUntil(env.QUEUE.send({ type: "enqueuePendingDomains" }));
		}

		// Every day at midnight
		if (controller.cron === "0 0 * * *") {
			waitUntil(env.QUEUE.send({ type: "clean" }));
			waitUntil(env.QUEUE.send({ type: "cleanCronJobPings" }));
		}

		// Every day at 6 AM UTC - Check SSL certificates
		if (controller.cron === "0 6 * * *") {
			waitUntil(env.QUEUE.send({ type: "checkSsl" }));
		}

		// Every hour - Check DNS monitors
		if (controller.cron === "0 * * * *") {
			waitUntil(env.QUEUE.send({ type: "checkDns" }));
		}

		// Every 5 minutes - Check TCP monitors
		if (controller.cron === "*/5 * * * *") {
			waitUntil(env.QUEUE.send({ type: "checkTcp" }));
		}

		// Every day at 1 AM UTC - Aggregate daily stats
		if (controller.cron === "0 1 * * *") {
			waitUntil(env.QUEUE.send({ type: "aggregateDailyStats" }));
		}
	},

	async queue(batch) {
		let { z } = await import("zod/v4");

		for (let message of batch.messages) {
			let result = z
				.discriminatedUnion("type", [
					z.object({
						type: z.literal("ping"),
						payload: z.object({ monitorId: z.uuid(), ownerId: z.uuid() }),
					}),
					z.object({ type: z.literal("clean") }),
					z.object({ type: z.literal("cleanCronJobPings") }),
					z.object({ type: z.literal("enqueuePendingDomains") }),
					z.object({
						type: z.literal("verifyDomainOwnership"),
						teamDomainId: z.uuid(),
					}),
					z.object({ type: z.literal("checkSsl") }),
					z.object({ type: z.literal("checkDns") }),
					z.object({ type: z.literal("checkTcp") }),
					z.object({ type: z.literal("checkCronJobs") }),
					z.object({ type: z.literal("aggregateDailyStats") }),
					z.object({ type: z.literal("backfillDailyStats") }),
				])
				.safeParse(message.body);

			if (result.success === false) {
				console.error(result.error);
				message.retry();
				continue;
			}

			if (result.data.type === "ping") {
				let { PingJob } = await import("./jobs/ping");
				waitUntil(PingJob.run({ message: message as Message<JSONValue> }));
			}

			if (result.data.type === "clean") {
				let { CleanJob } = await import("./jobs/clean");
				waitUntil(
					CleanJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CleanJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "cleanCronJobPings") {
				let { CleanCronJobPingsJob } = await import("./jobs/clean-cron-job-pings");
				waitUntil(
					CleanCronJobPingsJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CleanCronJobPingsJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "enqueuePendingDomains") {
				let { EnqueuePendingDomainsJob } = await import("./jobs/enqueue-pending-domains");
				waitUntil(
					EnqueuePendingDomainsJob.run({
						message: message as Message<JSONValue>,
						uptime: {
							monitorId: EnqueuePendingDomainsJob.monitorId,
							token: env.UPTIME_CRON_API_KEY,
						},
					}),
				);
			}

			if (result.data.type === "verifyDomainOwnership") {
				let { VerifyDomainOwnershipJob } = await import("./jobs/verify-domain-ownership");
				waitUntil(VerifyDomainOwnershipJob.run({ message: message as Message<JSONValue> }));
			}

			if (result.data.type === "checkSsl") {
				let { CheckSslJob } = await import("./jobs/check-ssl");
				waitUntil(
					CheckSslJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CheckSslJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "checkDns") {
				let { CheckDnsJob } = await import("./jobs/check-dns");
				waitUntil(
					CheckDnsJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CheckDnsJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "checkTcp") {
				let { CheckTcpJob } = await import("./jobs/check-tcp");
				waitUntil(
					CheckTcpJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CheckTcpJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "checkCronJobs") {
				let { CheckCronJobsJob } = await import("./jobs/check-cron-jobs");
				waitUntil(
					CheckCronJobsJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: CheckCronJobsJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "aggregateDailyStats") {
				let { AggregateDailyStatsJob } = await import("./jobs/aggregate-daily-stats");
				waitUntil(
					AggregateDailyStatsJob.run({
						message: message as Message<JSONValue>,
						uptime: { monitorId: AggregateDailyStatsJob.monitorId, token: env.UPTIME_CRON_API_KEY },
					}),
				);
			}

			if (result.data.type === "backfillDailyStats") {
				let { BackfillDailyStatsJob } = await import("./jobs/backfill-daily-stats");
				waitUntil(BackfillDailyStatsJob.run({ message: message as Message<JSONValue> }));
			}
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
