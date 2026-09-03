/**
 * Where every declared job's handler comes from, and the registry both worker handlers
 * delegate to. Handlers are mapped as loaders, so an isolate serving requests imports
 * none of them: a module is pulled in only once a message has matched its job and parsed
 * against its schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@pkg/jobs-next";

import { createJobDispatcher } from "@pkg/jobs-next";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { costLedger } from "~/app/jobs/middleware/cost-ledger";
import { database } from "~/app/jobs/middleware/database";
import { sendQueueBatch } from "~/app/lib/queue";

export const dispatcher = createJobDispatcher({
	send: sendQueueBatch,
	/**
	 * The ledger is outermost so it counts the database the middleware inside it opens,
	 * along with everything the handler then does through it.
	 */
	middleware: [costLedger(), database()],
	uptime: () => env.UPTIME_CRON_API_KEY,
	/**
	 * This worker consumes its own dead-letter queue too (ADR-018), so those batches are
	 * recorded and acked rather than dispatched.
	 */
	deadLetterQueue: "ping-dlq",
	/**
	 * A body matching no job or failing its schema goes straight to the dead-letter queue,
	 * instead of spending three redeliveries on a payload no redelivery can fix.
	 */
	onInvalid: async (_message, body) => {
		await env.DLQ.send(body, { contentType: "json" });
	},
});

dispatcher.map(jobs.enqueueDueChecks, () => import("~/app/jobs/enqueue-due-checks"));
dispatcher.map(jobs.checkHttp, () => import("~/app/jobs/check-http"));
dispatcher.map(jobs.checkCronJobs, () => import("~/app/jobs/check-cron-jobs"));
dispatcher.map(jobs.checkTcp, () => import("~/app/jobs/check-tcp"));
dispatcher.map(jobs.checkDns, () => import("~/app/jobs/check-dns"));
dispatcher.map(jobs.checkFlows, () => import("~/app/jobs/check-flows"));
dispatcher.map(jobs.enqueuePendingDomains, () => import("~/app/jobs/enqueue-pending-domains"));
dispatcher.map(jobs.verifyDomainOwnership, () => import("~/app/jobs/verify-domain-ownership"));
dispatcher.map(jobs.checkTrialWatches, () => import("~/app/jobs/check-trial-watches"));
dispatcher.map(jobs.clean, () => import("~/app/jobs/clean"));
dispatcher.map(jobs.cleanCronJobPings, () => import("~/app/jobs/clean-cron-job-pings"));
dispatcher.map(jobs.aggregateDailyStats, () => import("~/app/jobs/aggregate-daily-stats"));
dispatcher.map(jobs.reconcileSubscriptions, () => import("~/app/jobs/reconcile-subscriptions"));
dispatcher.map(jobs.reportCosts, () => import("~/app/jobs/report-costs"));
dispatcher.map(jobs.deleteAccounts, () => import("~/app/jobs/delete-accounts"));
dispatcher.map(jobs.checkSsl, () => import("~/app/jobs/check-ssl"));
dispatcher.map(jobs.sendTrialDigests, () => import("~/app/jobs/send-trial-digests"));
dispatcher.map(jobs.sendFunnelReport, () => import("~/app/jobs/send-funnel-report"));
dispatcher.map(jobs.sendTeamDailyDigests, () => import("~/app/jobs/send-team-daily-digests"));
dispatcher.map(jobs.sendTeamWeeklyDigests, () => import("~/app/jobs/send-team-weekly-digests"));
dispatcher.map(jobs.notify, () => import("~/app/jobs/notify"));

declare module "@pkg/jobs-next" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
