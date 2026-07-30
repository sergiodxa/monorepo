/**
 * Cloudflare Worker entry point for the uptime app. Its `fetch` handler resolves
 * the session cookie secret, opens a service-container scope, builds the application
 * router, and forwards the request to it. Its `scheduled` handler dispatches cron
 * triggers, and its `queue` handler validates and runs the matching background job.
 * Re-exports the `GeoFetchDO` Durable Object class its binding needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { logger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { env, waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";

import Customer from "~/app/data/customer";
import Monitor from "~/app/data/monitor";
import { GeoFetchDO } from "~/app/do/geo-fetch";
import { AggregateDailyStatsJob } from "~/app/jobs/aggregate-daily-stats";
import { CheckCronJobsJob } from "~/app/jobs/check-cron-jobs";
import { CheckDnsJob } from "~/app/jobs/check-dns";
import { CheckHttpJob } from "~/app/jobs/check-http";
import { CheckSslJob } from "~/app/jobs/check-ssl";
import { CheckTcpJob } from "~/app/jobs/check-tcp";
import { CleanJob } from "~/app/jobs/clean";
import { CleanCronJobPingsJob } from "~/app/jobs/clean-cron-job-pings";
import { EnqueuePendingDomainsJob } from "~/app/jobs/enqueue-pending-domains";
import { VerifyDomainOwnershipJob } from "~/app/jobs/verify-domain-ownership";
import { container } from "~/app/lib/container";

import application from "./app";

export { GeoFetchDO };

/**
 * Every queue message type the worker understands. Message shapes are a stable
 * contract with whatever is already enqueuing or processing messages — renaming a
 * `type` string or payload field breaks messages already in flight.
 */
const QueueMessageSchema = s.variant("type", {
	checkHttp: s.object({
		type: s.literal("checkHttp"),
		id: s.string(),
		monitorId: s.string(),
		scheduledAt: s.number(),
	}),
	clean: s.object({ type: s.literal("clean") }),
	cleanCronJobPings: s.object({ type: s.literal("cleanCronJobPings") }),
	enqueuePendingDomains: s.object({ type: s.literal("enqueuePendingDomains") }),
	verifyDomainOwnership: s.object({ type: s.literal("verifyDomainOwnership") }),
	checkSsl: s.object({ type: s.literal("checkSsl") }),
	checkDns: s.object({ type: s.literal("checkDns") }),
	checkTcp: s.object({ type: s.literal("checkTcp") }),
	checkCronJobs: s.object({ type: s.literal("checkCronJobs") }),
	aggregateDailyStats: s.object({ type: s.literal("aggregateDailyStats") }),
});

/** Whether the request arrived on a non-production host (local dev or workers.dev). */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

export default {
	/**
	 * Handles incoming Worker requests by opening a container scope and forwarding the
	 * request to the app router.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let app = application({
				kv: env.KV,
				cookieSecret: env.COOKIE_SESSION_SECRET,
				secure: isSecureHost(request),
			});
			return await app.fetch(request);
		});
	},

	/** Dispatches cron triggers. Only the crons this phase's jobs need are handled. */
	async scheduled(controller) {
		await container.scope(async () => {
			// Every minute: enqueue a `checkHttp` message for every monitor due for a check,
			// plus a sweep of cron-job monitors for late/missed transitions.
			if (controller.cron === "* * * * *") {
				let db = getServiceContainer().get(Database);
				let due = await Monitor.findDue(db, controller.scheduledTime);

				/**
				 * Billing is settled here rather than in the consumer, so an enqueued check is
				 * always one that's allowed to run. Polar is asked once per distinct owner,
				 * not once per due monitor.
				 */
				let polar = getServiceContainer().get(PolarClient);
				let subscribed = await Customer.filterActiveSubscribers(
					polar,
					due.map((monitor) => monitor.ownerId),
				);
				let payable = due.filter((monitor) => subscribed.has(monitor.ownerId));

				if (payable.length > 0) {
					waitUntil(
						env.QUEUE.sendBatch(
							payable.map((monitor) => ({
								body: {
									type: "checkHttp",
									/**
									 * Deliberately one id per monitor per minute, not per delivery — see
									 * `Monitor.scheduledJobId` for why this cron fires more than once a
									 * minute and what collides when it does.
									 */
									id: Monitor.scheduledJobId(monitor.monitorId, controller.scheduledTime),
									monitorId: monitor.monitorId,
									scheduledAt: controller.scheduledTime,
								},
								contentType: "json",
							})),
						),
					);
				}
				waitUntil(env.QUEUE.send({ type: "checkCronJobs" }));
			}

			// Every 5 minutes: sweep every enabled TCP monitor.
			if (controller.cron === "*/5 * * * *") {
				waitUntil(env.QUEUE.send({ type: "checkTcp" }));
			}

			// Every 10 minutes: re-enqueue verification for every unverified team domain.
			if (controller.cron === "*/10 * * * *") {
				waitUntil(env.QUEUE.send({ type: "enqueuePendingDomains" }));
			}

			// Every hour: sweep every enabled DNS monitor.
			if (controller.cron === "0 * * * *") {
				waitUntil(env.QUEUE.send({ type: "checkDns" }));
			}

			// Daily at midnight: purge old `monitor_results` and `cron_job_pings` rows.
			if (controller.cron === "0 0 * * *") {
				waitUntil(env.QUEUE.send({ type: "clean" }));
				waitUntil(env.QUEUE.send({ type: "cleanCronJobPings" }));
			}

			// Daily at 1 AM UTC: roll up yesterday's checks into `monitor_daily_stats`.
			if (controller.cron === "0 1 * * *") {
				waitUntil(env.QUEUE.send({ type: "aggregateDailyStats" }));
			}

			// Daily at 6 AM UTC: re-evaluate SSL certificate status for every HTTP monitor.
			if (controller.cron === "0 6 * * *") {
				waitUntil(env.QUEUE.send({ type: "checkSsl" }));
			}
		});
	},

	/** Validates and runs the matching background job for each queued message. */
	async queue(batch) {
		await container.scope(async () => {
			let uptime = env.UPTIME_CRON_API_KEY;

			for (let message of batch.messages) {
				let result = s.parseSafe(QueueMessageSchema, message.body);

				if (!result.success) {
					logger.error("queue.invalid_message", { body: message.body });
					message.ack();
					continue;
				}

				switch (result.value.type) {
					case "checkHttp":
						waitUntil(CheckHttpJob.run({ message, uptime }));
						break;
					case "clean":
						waitUntil(CleanJob.run({ message, uptime }));
						break;
					case "checkDns":
						waitUntil(CheckDnsJob.run({ message, uptime }));
						break;
					case "checkTcp":
						waitUntil(CheckTcpJob.run({ message, uptime }));
						break;
					case "checkCronJobs":
						waitUntil(CheckCronJobsJob.run({ message, uptime }));
						break;
					case "cleanCronJobPings":
						waitUntil(CleanCronJobPingsJob.run({ message, uptime }));
						break;
					case "enqueuePendingDomains":
						waitUntil(EnqueuePendingDomainsJob.run({ message, uptime }));
						break;
					case "verifyDomainOwnership":
						waitUntil(VerifyDomainOwnershipJob.run({ message, uptime }));
						break;
					case "checkSsl":
						waitUntil(CheckSslJob.run({ message, uptime }));
						break;
					case "aggregateDailyStats":
						waitUntil(AggregateDailyStatsJob.run({ message, uptime }));
						break;
					default:
						// Valid message, but this phase doesn't implement its job yet.
						message.ack();
				}
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
