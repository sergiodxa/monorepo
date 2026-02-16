import type { RequestHandler } from "react-router";

import { logger } from "@pkg/logger";
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
		let uptime = env.UPTIME_CRON_API_KEY;

		for (let message of batch.messages) {
			let result = z
				.discriminatedUnion("type", [
					z.object({ type: z.literal("ping") }),
					z.object({ type: z.literal("clean") }),
					z.object({ type: z.literal("cleanCronJobPings") }),
					z.object({ type: z.literal("enqueuePendingDomains") }),
					z.object({ type: z.literal("verifyDomainOwnership") }),
					z.object({ type: z.literal("checkSsl") }),
					z.object({ type: z.literal("checkDns") }),
					z.object({ type: z.literal("checkTcp") }),
					z.object({ type: z.literal("checkCronJobs") }),
					z.object({ type: z.literal("aggregateDailyStats") }),
				])
				.transform((data) => data.type)
				.safeParse(message.body);

			if (result.success === false) {
				logger.error("Invalid message received in queue", {
					error: result.error,
					message: message.body,
				});
				message.ack();
				continue;
			}

			if (result.data === "ping") {
				let { PingJob } = await import("./jobs/ping");
				waitUntil(PingJob.run({ message }));
			}

			if (result.data === "clean") {
				let { CleanJob } = await import("./jobs/clean");
				waitUntil(CleanJob.run({ message, uptime }));
			}

			if (result.data === "cleanCronJobPings") {
				let { CleanCronJobPingsJob } = await import("./jobs/clean-cron-job-pings");
				waitUntil(CleanCronJobPingsJob.run({ message, uptime }));
			}

			if (result.data === "enqueuePendingDomains") {
				let { EnqueuePendingDomainsJob } = await import("./jobs/enqueue-pending-domains");
				waitUntil(EnqueuePendingDomainsJob.run({ message, uptime }));
			}

			if (result.data === "verifyDomainOwnership") {
				let { VerifyDomainOwnershipJob } = await import("./jobs/verify-domain-ownership");
				waitUntil(VerifyDomainOwnershipJob.run({ message }));
			}

			if (result.data === "checkSsl") {
				let { CheckSslJob } = await import("./jobs/check-ssl");
				waitUntil(CheckSslJob.run({ message, uptime }));
			}

			if (result.data === "checkDns") {
				let { CheckDnsJob } = await import("./jobs/check-dns");
				waitUntil(CheckDnsJob.run({ message, uptime }));
			}

			if (result.data === "checkTcp") {
				let { CheckTcpJob } = await import("./jobs/check-tcp");
				waitUntil(CheckTcpJob.run({ message, uptime }));
			}

			if (result.data === "checkCronJobs") {
				let { CheckCronJobsJob } = await import("./jobs/check-cron-jobs");
				waitUntil(CheckCronJobsJob.run({ message, uptime }));
			}

			if (result.data === "aggregateDailyStats") {
				let { AggregateDailyStatsJob } = await import("./jobs/aggregate-daily-stats");
				waitUntil(AggregateDailyStatsJob.run({ message, uptime }));
			}
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
