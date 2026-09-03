/**
 * Every background job this app runs, declared in one map: the payload each carries, the
 * schedule it is enqueued on, and the cron-job monitor that watches it. Importing this
 * costs the schemas and nothing else, so a request handler can enqueue without pulling in
 * any job's dependencies. Each key is the message `type` on the wire — renaming one
 * renames a message the previous deploy may still have in flight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/**
 * The transition to notify about. The statuses are strings here and narrowed against the
 * set the monitor type allows by the handler, since a single object schema can't express
 * "these values depend on that field".
 */
const NotifySchema = s.object({
	monitorId: s.string(),
	monitorType: s.enum_(["dns", "tcp", "cron", "flow", "ssl"]),
	previousStatus: s.nullable(s.string()),
	newStatus: s.string(),
});

const CheckHttpSchema = s.object({
	/**
	 * Globally unique id for this check, reused as the `monitor_results` primary key so a
	 * redelivered message can be recognized and dropped.
	 */
	id: s.string(),
	monitorId: s.string(),
	/** When the check was scheduled; the run itself may happen later. */
	scheduledAt: s.number(),
});

/** The transition one `notify` message carries. */
export type NotifyInput = s.InferOutput<typeof NotifySchema>;

/** The check one `checkHttp` message asks for. */
export type CheckHttpInput = s.InferOutput<typeof CheckHttpSchema>;

export default jobs({
	/**
	 * The every-minute sweep that claims due HTTP monitors and fans one `checkHttp`
	 * message out per monitor, so the fan-out spends the queue's budget rather than the
	 * cron trigger's.
	 */
	enqueueDueChecks: job({ cron: "* * * * *" }),
	checkHttp: job({ input: CheckHttpSchema }),
	/**
	 * The three sweeps that share the every-minute delivery, each claiming only what its
	 * own `interval_seconds` has made due — a delivery with nothing due costs an indexed
	 * range that matches no rows. Flow monitors ride along even though their finest
	 * interval is fifteen minutes (ADR-027 §7a), for the same reason.
	 */
	checkCronJobs: job({ cron: "* * * * *", monitorId: "70a5dba9-8447-4cc0-a5f6-d0e41dc6b9e5" }),
	checkTcp: job({ cron: "* * * * *", monitorId: "94276ec1-18f9-4dde-8a09-c5a00df29454" }),
	checkDns: job({ cron: "* * * * *", monitorId: "3a620acd-43f9-4f48-9a32-b9a87698e44e" }),
	checkFlows: job({ cron: "* * * * *" }),
	enqueuePendingDomains: job({
		cron: "*/10 * * * *",
		monitorId: "9a2e4fe3-f5fe-4365-8b8f-2f2d90d6101c",
	}),
	verifyDomainOwnership: job({ input: s.object({ teamDomainId: s.string() }) }),
	/**
	 * Its own hourly schedule, since an hour is the free watch's whole cadence and is
	 * fixed by the product: a finer delivery would spend a queue hop to read an indexed
	 * range that matches nothing in fifty-nine minutes out of sixty.
	 */
	checkTrialWatches: job({ cron: "0 * * * *" }),
	clean: job({ cron: "0 0 * * *", monitorId: "80294988-476e-4e99-9f5c-abfeb369316a" }),
	cleanCronJobPings: job({
		cron: "0 0 * * *",
		monitorId: "31db20cb-8736-44fa-9ac7-448d2200befd",
	}),
	aggregateDailyStats: job({
		cron: "0 1 * * *",
		monitorId: "3f5a0689-1ced-4fcc-826d-3c1dc3c2795e",
	}),
	/**
	 * Daily at 2 AM UTC: repair the subscription projection against Polar, in case a
	 * webhook was missed. The one Polar query left on the billing path.
	 */
	reconcileSubscriptions: job({
		cron: "0 2 * * *",
		monitorId: "2df6d6d9-54e9-4a84-954a-e1d357421459",
	}),
	reportCosts: job({ cron: "0 3 * * *", monitorId: "ddf291cc-5fd5-4ab7-b016-dea824399990" }),
	/**
	 * Daily at 4 AM UTC: erases the accounts queued for deletion. Runs after 02:00, once
	 * reconciliation has finished and cannot re-write a row being deleted, and on its own
	 * hour so a cost-report failure and an account erasure never delay each other.
	 */
	deleteAccounts: job({ cron: "0 4 * * *" }),
	/**
	 * Daily at 6 AM UTC: re-evaluates SSL certificate status for every HTTP monitor and
	 * sends the free trial's daily digests. Running six hours after the midnight cleanup
	 * that deletes expired watches and leads keeps every digest built from settled rows.
	 */
	checkSsl: job({ cron: "0 6 * * *", monitorId: "2140cbc2-e18e-441c-9ef9-3d516a9e3a19" }),
	sendTrialDigests: job({ cron: "0 6 * * *" }),
	sendFunnelReport: job({ cron: "0 7 * * *", monitorId: "b6f2e0a4-9c31-4d58-a0e7-5f8c1b2d47a9" }),
	/**
	 * The two team digests, one job each. The period is carried by the job rather than by
	 * a field, because each schedule reports to its own cron-job monitor and a monitor
	 * watches one schedule.
	 */
	sendTeamDailyDigests: job({
		cron: "0 8 * * *",
		monitorId: "03acb710-cd5b-4c8a-8242-c2a2a9dae201",
	}),
	sendTeamWeeklyDigests: job({
		cron: "0 9 * * 1",
		monitorId: "4715a9ac-7fe6-4423-816c-b4a711b00dda",
	}),
	notify: job({ input: NotifySchema }),
});
