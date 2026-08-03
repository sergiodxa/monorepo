/**
 * Cloudflare Worker entry point for the uptime app. Its `fetch` handler resolves
 * the session cookie secret, opens a service-container scope, builds the application
 * router, and forwards the request to it. Its `scheduled` handler dispatches cron
 * triggers, and its `queue` handler validates and runs the matching background job — for
 * the work queue and for the dead-letter queue both, since one handler serves every queue
 * the worker consumes. Re-exports the `GeoFetchDO` Durable Object class its binding needs.
 *
 * Each of the three handlers is also where a unit of work's cost ledger begins and ends
 * (ADR-007 §3): `fetch` and `scheduled` open one directly, while a queue batch's jobs get
 * one each from the usage tracker — a batch is a single invocation running up to ten jobs
 * concurrently, and one ledger between them would pool their cost into a number that
 * answers nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { logger } from "@pkg/logger";
import { getServiceContainer } from "@pkg/service-container";
import { env, waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";

import Monitor from "~/app/data/monitor";
import { GeoFetchDO } from "~/app/do/geo-fetch";
import { AggregateDailyStatsJob } from "~/app/jobs/aggregate-daily-stats";
import { CheckCronJobsJob } from "~/app/jobs/check-cron-jobs";
import { CheckDnsJob } from "~/app/jobs/check-dns";
import { CheckHttpJob } from "~/app/jobs/check-http";
import { CheckSslJob } from "~/app/jobs/check-ssl";
import { CheckTcpJob } from "~/app/jobs/check-tcp";
import { CheckTrialWatchesJob } from "~/app/jobs/check-trial-watches";
import { CleanJob } from "~/app/jobs/clean";
import { CleanCronJobPingsJob } from "~/app/jobs/clean-cron-job-pings";
import { DeadLetterJob } from "~/app/jobs/dead-letter";
import { EnqueuePendingDomainsJob } from "~/app/jobs/enqueue-pending-domains";
import { NotifyJob } from "~/app/jobs/notify";
import { ReconcileSubscriptionsJob } from "~/app/jobs/reconcile-subscriptions";
import { ReportCostsJob } from "~/app/jobs/report-costs";
import { SendFunnelReportJob } from "~/app/jobs/send-funnel-report";
import { SendTeamDailyDigestsJob, SendTeamWeeklyDigestsJob } from "~/app/jobs/send-team-digests";
import { SendTrialDigestsJob } from "~/app/jobs/send-trial-digests";
import { VerifyDomainOwnershipJob } from "~/app/jobs/verify-domain-ownership";
import { container } from "~/app/lib/container";
import { sendQueueBatch, sendQueueMessage } from "~/app/lib/queue";
import {
	apportionCostByTeam,
	CostLedger,
	countedKv,
	setQueueBatchSize,
	trackCost,
} from "~/app/services/cost";

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
	reconcileSubscriptions: s.object({ type: s.literal("reconcileSubscriptions") }),
	reportCosts: s.object({ type: s.literal("reportCosts") }),
	checkTrialWatches: s.object({ type: s.literal("checkTrialWatches") }),
	sendTrialDigests: s.object({ type: s.literal("sendTrialDigests") }),
	sendFunnelReport: s.object({ type: s.literal("sendFunnelReport") }),
	/**
	 * The two team digests, one message type each. The period is carried by the type rather
	 * than by a field, because each schedule reports to its own cron-job monitor and a
	 * monitor is read off the job class — see `send-team-digests.ts`.
	 */
	sendTeamDailyDigests: s.object({ type: s.literal("sendTeamDailyDigests") }),
	sendTeamWeeklyDigests: s.object({ type: s.literal("sendTeamWeeklyDigests") }),
	/**
	 * One monitor status transition to alert on, enqueued by whichever sweep detected it
	 * so the notification never runs on the sweep's critical path. The statuses are
	 * validated loosely here (the set of valid values differs per monitor type) and
	 * strictly by `NotifyJob` itself.
	 */
	notify: s.object({
		type: s.literal("notify"),
		monitorId: s.string(),
		monitorType: s.enum_(["dns", "tcp", "cron", "ssl"]),
		previousStatus: s.nullable(s.string()),
		newStatus: s.string(),
	}),
});

/**
 * Name of the dead-letter queue, as declared in `wrangler.jsonc` (ADR-018). This worker
 * consumes two queues and the platform delivers both to the single `queue` handler below,
 * so the name has to exist in code as well as in config: `MessageBatch.queue` carries it,
 * and it is the only thing that says which queue a batch came from.
 */
const DEAD_LETTER_QUEUE = "ping-dlq";

/** Whether the request arrived on a non-production host (local dev or workers.dev). */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

/**
 * Enqueues the work one cron delivery implies. Split out of the `scheduled` handler so the
 * whole of it — including the claim whose result decides the delivery's cost attribution —
 * runs inside one cost ledger.
 * @param controller The trigger being dispatched.
 */
async function dispatchCron(controller: ScheduledController): Promise<void> {
	// Every minute: enqueue a `checkHttp` message for every monitor due for a check,
	// plus a sweep of cron-job monitors for late/missed transitions and the TCP and DNS
	// sweeps, which claim only the monitors their own `interval_seconds` has made due.
	if (controller.cron === "* * * * *") {
		let db = getServiceContainer().get(Database);
		/**
		 * Claims the monitors that are due, advancing each one's next due time as it
		 * does, so the later deliveries of this same minute's cron find nothing left to
		 * enqueue.
		 *
		 * Nothing here asks about billing any more (ADR-005). Revoking a subscription
		 * unschedules that owner's monitors the moment the webhook lands, so `next_due_at`
		 * already carries the answer and a claimed monitor is by construction one that is
		 * allowed to run. This used to ask Polar once per distinct owner per delivery —
		 * 43,200 × K requests a month as one wide `Promise.all` burst — through a call that
		 * returns `false` on any error, so a Polar outage silently stopped every customer's
		 * monitoring.
		 */
		let due = await Monitor.findDue(db, controller.scheduledTime);

		/**
		 * The claim, this invocation, and the four sweep messages below are all caused
		 * collectively by whoever was due, so they are split by due monitors per team
		 * (ADR-007 §5). Note what that means on a quiet platform: a customer with a single
		 * 1-minute monitor absorbs nearly the whole scan. That is not an artifact — it is
		 * the signal ADR-003 exists to remove.
		 */
		apportionCostByTeam(due.map((monitor) => monitor.team_id));

		if (due.length > 0) {
			waitUntil(
				sendQueueBatch(
					due.map((monitor) => ({
						type: "checkHttp",
						/**
						 * Deliberately one id per monitor per minute, not per delivery — see
						 * `Monitor.scheduledJobId` for why this cron fires more than once a
						 * minute and what collides when it does.
						 */
						id: Monitor.scheduledJobId(monitor.id, controller.scheduledTime),
						monitorId: monitor.id,
						scheduledAt: controller.scheduledTime,
					})),
				),
			);
		}
		waitUntil(sendQueueMessage({ type: "checkCronJobs" }));
		/**
		 * Every minute rather than the 5-minute and hourly triggers these used to have,
		 * because a monitor's `interval_seconds` can be as fine as 60 and a coarser
		 * delivery made the finer setting unreachable. Both jobs claim before they check,
		 * so a delivery with nothing due costs one indexed range that matches no rows.
		 */
		waitUntil(sendQueueMessage({ type: "checkTcp" }));
		waitUntil(sendQueueMessage({ type: "checkDns" }));
	}

	// Every 10 minutes: re-enqueue verification for every unverified team domain.
	if (controller.cron === "*/10 * * * *") {
		waitUntil(sendQueueMessage({ type: "enqueuePendingDomains" }));
	}

	/**
	 * Hourly: re-check the URLs left on the public trial page. Its own trigger rather than a
	 * share of the every-minute one, because an hour is the free watch's whole cadence and is
	 * fixed by the product — the sweep claims before it checks, so a finer delivery would read
	 * an indexed range that matches nothing in fifty-nine minutes out of sixty and pay for the
	 * queue hop each time.
	 */
	if (controller.cron === "0 * * * *") {
		waitUntil(sendQueueMessage({ type: "checkTrialWatches" }));
	}

	// Daily at midnight: purge old `monitor_results` and `cron_job_pings` rows.
	if (controller.cron === "0 0 * * *") {
		waitUntil(sendQueueMessage({ type: "clean" }));
		waitUntil(sendQueueMessage({ type: "cleanCronJobPings" }));
	}

	// Daily at 1 AM UTC: roll up yesterday's checks into `monitor_daily_stats`.
	if (controller.cron === "0 1 * * *") {
		waitUntil(sendQueueMessage({ type: "aggregateDailyStats" }));
	}

	// Daily at 2 AM UTC: repair the subscription projection against Polar, in case a
	// webhook was missed. The one Polar query left on the billing path.
	if (controller.cron === "0 2 * * *") {
		waitUntil(sendQueueMessage({ type: "reconcileSubscriptions" }));
	}

	// Daily at 3 AM UTC: price yesterday's recorded cost per team and report it to Polar.
	if (controller.cron === "0 3 * * *") {
		waitUntil(sendQueueMessage({ type: "reportCosts" }));
	}

	/**
	 * Daily at 6 AM UTC: re-evaluate SSL certificate status for every HTTP monitor, and send
	 * the free trial's daily digests.
	 *
	 * The digest rides the last of the daily triggers on purpose. It has to run after midnight
	 * UTC, since the once-a-day bound it enforces is counted against that boundary, and it has
	 * to stay clear of the midnight cleanup, which is what deletes expired watches and orphaned
	 * leads — six hours is more than that sweep can take, so a digest is never assembled from
	 * rows being deleted underneath it. 06:00 UTC is also the most humane of the five for an
	 * email a person actually reads.
	 */
	if (controller.cron === "0 6 * * *") {
		waitUntil(sendQueueMessage({ type: "checkSsl" }));
		waitUntil(sendQueueMessage({ type: "sendTrialDigests" }));
	}

	/**
	 * Daily at 7 AM UTC: count yesterday's trial funnel, store the day, and mail the report.
	 *
	 * Last of the daily triggers, and on its own hour rather than sharing 06:00, so a failure in
	 * the SSL sweep or the digests neither delays nor is delayed by a report about them. It
	 * reads only the previous UTC day, so the midnight cleanup finished seven hours before it
	 * starts and cannot be deleting rows it is counting.
	 */
	if (controller.cron === "0 7 * * *") {
		waitUntil(sendQueueMessage({ type: "sendFunnelReport" }));
	}

	/**
	 * Daily at 8 AM UTC: mail every team's members yesterday's monitor digest.
	 *
	 * After the 01:00 roll-up, because that is what writes the day this reports, and on its own
	 * hour rather than sharing 06:00 or 07:00 so a failure in the SSL sweep, the trial digests or
	 * the funnel report neither delays nor is delayed by mail going to paying customers. It is
	 * also the last of the daily triggers, which makes it the most humane hour of the five for
	 * something a person reads.
	 */
	if (controller.cron === "0 8 * * *") {
		waitUntil(sendQueueMessage({ type: "sendTeamDailyDigests" }));
	}

	/**
	 * Mondays at 9 AM UTC: the same digest over the last seven days.
	 *
	 * Monday because the week it reports is the one that just ended, and an hour after the daily
	 * one because on this day a member gets both — the two are separate switches and a reader who
	 * turned one off still gets the other, so neither may depend on the other having run.
	 */
	if (controller.cron === "0 9 * * 1") {
		waitUntil(sendQueueMessage({ type: "sendTeamWeeklyDigests" }));
	}
}

export default {
	/**
	 * Handles incoming Worker requests by opening a container scope and forwarding the
	 * request to the app router.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let app = application({
				kv: countedKv(env.KV),
				cookieSecret: env.COOKIE_SESSION_SECRET,
				secure: isSecureHost(request),
			});
			/**
			 * Which team a request is for is settled downstream — `requireTeam` for the app,
			 * the status-page controller for a public one — so the ledger opens unattributed
			 * and is told once the request has resolved whose it is. One that never does (a
			 * marketing page, a 404) is platform cost, which is the truth.
			 */
			return await trackCost(new CostLedger({ handler: "fetch" }), () => app.fetch(request));
		});
	},

	/** Dispatches cron triggers. Only the crons this phase's jobs need are handled. */
	async scheduled(controller) {
		await container.scope(async () => {
			/**
			 * One ledger for the whole delivery. Only the every-minute trigger has teams to
			 * attribute to — it learns them from the claim below — so the daily triggers record
			 * their invocation and their queue write as platform cost, which is what they are.
			 */
			await trackCost(new CostLedger({ handler: "scheduled" }), () => dispatchCron(controller));
		});
	},

	/**
	 * Validates and runs the matching background job for each queued message, for both of
	 * the queues this worker consumes: `ping` and its dead-letter queue.
	 */
	async queue(batch) {
		await container.scope(async () => {
			/**
			 * The batch is one Worker invocation running every message in it, so each job owns
			 * one share of the single request it is billed as. Set before the loop below
			 * constructs any job's ledger, which is the moment each one reads it.
			 */
			setQueueBatchSize(batch.messages.length);

			/**
			 * Both queues' batches arrive at this one handler, so the dead-letter batches are
			 * separated out first. They carry the bodies of messages that already failed, in
			 * two different ways, and none of the routing below applies to them.
			 */
			if (batch.queue === DEAD_LETTER_QUEUE) {
				for (let message of batch.messages) DeadLetterJob.run(message);
				return;
			}

			let uptime = env.UPTIME_CRON_API_KEY;

			for (let message of batch.messages) {
				let result = s.parseSafe(QueueMessageSchema, message.body);

				if (!result.success) {
					logger.error("queue.invalid_message", { body: message.body });

					/**
					 * Sent to the dead-letter queue explicitly rather than by `message.retry()`:
					 * a body that matched no schema won't match one on the fourth delivery
					 * either, so retrying would spend three redeliveries to arrive at the same
					 * queue. Acking on its own is what used to happen here, and it discarded the
					 * payload. The `invalid` wrapper is what tells `DeadLetterJob` this body
					 * failed validation rather than exhausted its retries.
					 */
					await env.DLQ.send({ invalid: message.body }, { contentType: "json" });

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
					case "reconcileSubscriptions":
						waitUntil(ReconcileSubscriptionsJob.run({ message, uptime }));
						break;
					case "reportCosts":
						waitUntil(ReportCostsJob.run({ message, uptime }));
						break;
					case "checkTrialWatches":
						waitUntil(CheckTrialWatchesJob.run({ message, uptime }));
						break;
					case "sendTrialDigests":
						waitUntil(SendTrialDigestsJob.run({ message, uptime }));
						break;
					case "sendFunnelReport":
						waitUntil(SendFunnelReportJob.run({ message, uptime }));
						break;
					case "sendTeamDailyDigests":
						waitUntil(SendTeamDailyDigestsJob.run({ message, uptime }));
						break;
					case "sendTeamWeeklyDigests":
						waitUntil(SendTeamWeeklyDigestsJob.run({ message, uptime }));
						break;
					case "notify":
						waitUntil(NotifyJob.run({ message, uptime }));
						break;
					default:
						// Valid message, but this phase doesn't implement its job yet.
						message.ack();
				}
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
