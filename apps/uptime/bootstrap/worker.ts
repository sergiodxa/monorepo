/**
 * Cloudflare Worker entry point for the uptime app. Its `fetch` handler resolves
 * the session cookie secret, opens a service-container scope, builds the application
 * router, and forwards the request to it. Its `scheduled` handler dispatches cron
 * triggers, and its `queue` handler validates and runs the matching background job,
 * for both the work queue and its dead-letter queue. Re-exports the `GeoFetchDO`
 * Durable Object class its binding needs.
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
import { CheckFlowsJob } from "~/app/jobs/check-flows";
import { CheckHttpJob } from "~/app/jobs/check-http";
import { CheckSslJob } from "~/app/jobs/check-ssl";
import { CheckTcpJob } from "~/app/jobs/check-tcp";
import { CheckTrialWatchesJob } from "~/app/jobs/check-trial-watches";
import { CleanJob } from "~/app/jobs/clean";
import { CleanCronJobPingsJob } from "~/app/jobs/clean-cron-job-pings";
import { DeadLetterJob } from "~/app/jobs/dead-letter";
import { DeleteAccountsJob } from "~/app/jobs/delete-accounts";
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
	checkFlows: s.object({ type: s.literal("checkFlows") }),
	checkTcp: s.object({ type: s.literal("checkTcp") }),
	checkCronJobs: s.object({ type: s.literal("checkCronJobs") }),
	aggregateDailyStats: s.object({ type: s.literal("aggregateDailyStats") }),
	reconcileSubscriptions: s.object({ type: s.literal("reconcileSubscriptions") }),
	reportCosts: s.object({ type: s.literal("reportCosts") }),
	deleteAccounts: s.object({ type: s.literal("deleteAccounts") }),
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
	 * so the notification never runs on the sweep's critical path. Validated loosely here,
	 * since valid values differ per monitor type, and strictly by `NotifyJob` itself.
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
 * Name of the dead-letter queue, as declared in `wrangler.jsonc` (ADR-018). Both
 * queues this worker consumes deliver to the single `queue` handler below, so
 * `MessageBatch.queue` is the only way to tell which queue a batch came from.
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
	/**
	 * Every minute: enqueue a `checkHttp` message for every due monitor, plus a sweep for
	 * cron-job, TCP, and DNS monitors, each of which claims only what its own
	 * `interval_seconds` has made due.
	 */
	if (controller.cron === "* * * * *") {
		let db = getServiceContainer().get(Database);
		/**
		 * Claims monitors due now, advancing each one's next due time so later deliveries
		 * within the same minute enqueue nothing more. Billing is already decided by
		 * `next_due_at` (ADR-005), replacing a per-owner Polar check that failed silently.
		 */
		let due = await Monitor.findDue(db, controller.scheduledTime);

		/**
		 * The claim, this invocation, and the four sweep messages below are split by due
		 * monitors per team (ADR-007 §5): a customer with one 1-minute monitor absorbing
		 * nearly the whole scan is the signal ADR-003 exists to surface.
		 */
		apportionCostByTeam(due.map((monitor) => monitor.team_id));

		if (due.length > 0) {
			waitUntil(
				sendQueueBatch(
					due.map((monitor) => ({
						type: "checkHttp",
						/**
						 * Keyed to the monitor and the minute, so every delivery within that minute
						 * collides onto the same id — see `Monitor.scheduledJobId` for why this cron
						 * can fire more than once a minute.
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
		 * Fires every minute so a monitor's `interval_seconds`, as fine as 60, stays
		 * reachable. Both jobs claim before they check, so a delivery with nothing due
		 * costs only an indexed range that matches no rows.
		 */
		waitUntil(sendQueueMessage({ type: "checkTcp" }));
		waitUntil(sendQueueMessage({ type: "checkDns" }));
		/**
		 * Flow monitors too, even though their finest interval is fifteen minutes
		 * (ADR-027 §7a). They share this delivery for the same reason the two jobs above
		 * do: the claim matches nothing when none is due, cheaper than a trigger per type.
		 */
		waitUntil(sendQueueMessage({ type: "checkFlows" }));
	}

	if (controller.cron === "*/10 * * * *") {
		waitUntil(sendQueueMessage({ type: "enqueuePendingDomains" }));
	}

	/**
	 * Runs on its own hourly trigger to re-check the URLs left on the public trial page,
	 * since an hour is the free watch's whole cadence and is fixed by the product. The
	 * sweep claims before it checks, so a finer delivery would match nothing most minutes.
	 */
	if (controller.cron === "0 * * * *") {
		waitUntil(sendQueueMessage({ type: "checkTrialWatches" }));
	}

	if (controller.cron === "0 0 * * *") {
		waitUntil(sendQueueMessage({ type: "clean" }));
		waitUntil(sendQueueMessage({ type: "cleanCronJobPings" }));
	}

	if (controller.cron === "0 1 * * *") {
		waitUntil(sendQueueMessage({ type: "aggregateDailyStats" }));
	}

	/**
	 * Daily at 2 AM UTC: repair the subscription projection against Polar, in case a
	 * webhook was missed. The one Polar query left on the billing path.
	 */
	if (controller.cron === "0 2 * * *") {
		waitUntil(sendQueueMessage({ type: "reconcileSubscriptions" }));
	}

	if (controller.cron === "0 3 * * *") {
		waitUntil(sendQueueMessage({ type: "reportCosts" }));
	}

	/**
	 * Daily at 4 AM UTC: erases the accounts queued for deletion. Runs after 02:00, once
	 * reconciliation has finished and cannot re-write a row being deleted, and on its own
	 * hour so a cost-report failure and an account erasure never delay each other.
	 */
	if (controller.cron === "0 4 * * *") {
		waitUntil(sendQueueMessage({ type: "deleteAccounts" }));
	}

	/**
	 * Daily at 6 AM UTC: re-evaluates SSL certificate status for every HTTP monitor and
	 * sends the free trial's daily digests. Running six hours after the midnight cleanup
	 * that deletes expired watches and leads keeps every digest built from settled rows.
	 */
	if (controller.cron === "0 6 * * *") {
		waitUntil(sendQueueMessage({ type: "checkSsl" }));
		waitUntil(sendQueueMessage({ type: "sendTrialDigests" }));
	}

	/**
	 * Daily at 7 AM UTC: counts yesterday's trial funnel, stores the day, and mails the
	 * report, on its own hour so an SSL-sweep or digest failure and this report stay
	 * independent. Reading only the previous UTC day keeps it clear of the midnight cleanup.
	 */
	if (controller.cron === "0 7 * * *") {
		waitUntil(sendQueueMessage({ type: "sendFunnelReport" }));
	}

	/**
	 * Daily at 8 AM UTC: mails every team's members yesterday's monitor digest. Runs after
	 * the 01:00 roll-up that writes the day it reports, on its own hour so failures in the
	 * SSL sweep, trial digests, or funnel report stay independent of mail reaching customers.
	 */
	if (controller.cron === "0 8 * * *") {
		waitUntil(sendQueueMessage({ type: "sendTeamDailyDigests" }));
	}

	/**
	 * Mondays at 9 AM UTC: the same digest over the last seven days. Monday because the
	 * week it reports just ended, and an hour after the daily one because a member can get
	 * both from independent switches, so neither may depend on the other having run.
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
			 * the status-page controller for a public one — so the ledger opens unattributed and
			 * is told once resolved. One that never resolves (a marketing page, a 404) is platform cost.
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
					 * Sent explicitly to the dead-letter queue, since a body matching no schema
					 * stays invalid across redeliveries. The `invalid` wrapper tells `DeadLetterJob`
					 * this failed validation, distinct from a message that exhausted its retries.
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
					case "checkFlows":
						waitUntil(CheckFlowsJob.run({ message, uptime }));
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
					case "deleteAccounts":
						waitUntil(DeleteAccountsJob.run({ message, uptime }));
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
						/**
						 * Acknowledges the message immediately, so a valid type without a matching
						 * case is never retried.
						 */
						message.ack();
				}
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
