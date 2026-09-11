/**
 * Where every declared job's handler comes from, and the registry both worker handlers
 * delegate to. Handlers are mapped as loaders, so an isolate serving requests imports
 * none of them: a module is pulled in only once a message has matched its job and parsed
 * against its schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@sdxc/jobs";
import type { AnyJobDefinition } from "@sdxc/jobs";

import { createJobDispatcher } from "@sdxc/jobs";
import { createUptimeReporter } from "@sdxc/jobs/uptime";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { admin } from "~/app/jobs/middleware/admin";
import { costLedger } from "~/app/jobs/middleware/cost-ledger";
import { database } from "~/app/jobs/middleware/database";
import { mailer } from "~/app/jobs/middleware/mailer";
import { jobQueue } from "~/app/lib/queue";
import { logger } from "~/bootstrap/logger";

/** Reports a completed run to the monitor watching it. The token resolves per call. */
const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });

/**
 * The monitor each job declares, by the name that job is addressed as. Built on first use
 * rather than at module scope, and read by name rather than through `ctx.of` per job: this
 * hook covers every monitored job in the map, so one lookup beats fifteen branches.
 */
let monitors: Map<string, string> | undefined;

/** Walks the map once, collecting every job that declares a monitor. */
function monitorFor(name: string): string | undefined {
	monitors ??= new Map(collect(jobs).map((job) => [job.name, job.meta.monitorId as string]));
	return monitors.get(name);
}

/**
 * Every declared job that carries a monitor, from a map nested as deeply as it is grouped.
 * @param tree One level of the job map.
 */
function collect(tree: object): AnyJobDefinition[] {
	return Object.values(tree).flatMap((value: AnyJobDefinition | object) => {
		if ("name" in value && typeof value.name === "string") {
			let declared = value as AnyJobDefinition;
			return declared.meta?.monitorId === undefined ? [] : [declared];
		}

		return collect(value);
	});
}

export const dispatcher = createJobDispatcher({
	logger,
	queue: jobQueue,

	/**
	 * Reports a completed run to the monitor watching it, when the job declares one. Awaited
	 * rather than handed to `waitUntil`, so a ping the service refuses reaches this run's
	 * own record instead of landing nowhere.
	 */
	async onEnd(ctx, status) {
		if (status.type !== "done") return;

		let monitorId = monitorFor(ctx.name);
		if (monitorId === undefined) return;

		await uptime(monitorId);
	},
	/**
	 * The ledger is outermost so it counts the database the middleware inside it opens,
	 * along with everything the handler then does through it.
	 */
	middleware: [costLedger(), database(), mailer(), admin()],
	/**
	 * This worker consumes its own dead-letter queue too (ADR-018), so those batches are
	 * recorded and acked rather than dispatched.
	 */
	deadLetterQueue: "ping-dlq",
	/**
	 * A body matching no job or failing its schema goes straight to the dead-letter queue,
	 * instead of spending three redeliveries on a payload no redelivery can fix.
	 */
	onInvalid: async (_delivery, body) => {
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

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
