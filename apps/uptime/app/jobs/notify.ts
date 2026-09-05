/**
 * Background job that dispatches the alerts for one monitor status transition, off the
 * sweep that detected it (ADR-008), reloading the monitor and rebuilding the alert
 * snapshot from what the sweep persisted before handing it to the same `notify*` policy
 * every inline caller uses. The queue delivers at least once, so this job is
 * deliberately re-runnable: per-alert cooldown bounds a redelivery to one repeat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@sdxc/jobs";
import type { Database } from "remix/data-table";

import { createJobHandler, Job } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { getServiceContainer } from "@sdxc/service-container";
import * as s from "remix/data-schema";

import type { NotifyInput } from "~/app/jobs";

import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import FlowMonitor from "~/app/data/flow-monitor";
import jobs from "~/app/jobs";
import {
	dnsAlertResultFromRecords,
	flowAlertResultFromResult,
	notifyCronJobResult,
	notifyDnsResult,
	notifyFlowResult,
	notifySslResult,
	notifyTcpResult,
} from "~/app/services/alerts";
import { calculateSslStatus } from "~/app/services/ssl-info";
import {
	cronJobMonitors,
	cronJobStatuses,
	dnsMonitors,
	flowMonitors,
	flowStatuses,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** The statuses each monitor type's transition can be between. */
const TCP_STATUSES = ["up", "down", "timeout"] as const;
const DNS_STATUSES = ["ok", "changed", "error"] as const;
const SSL_STATUSES = ["unknown", "valid", "expiring", "expired", "error"] as const;

/**
 * Narrows a message's statuses to the value set `values` allows, so each branch below can
 * hand them straight to its `notify*` helper. A status outside that set can only come
 * from a malformed message, which no amount of redelivery will fix.
 */
function parseStatuses<const Values extends readonly [string, ...string[]]>(
	ctx: CurrentJobContext,
	job: NotifyInput,
	values: Values,
): { previous: Values[number] | null; current: Values[number] } {
	let parsed = s.parseSafe(
		s.object({ previousStatus: s.nullable(s.enum_(values)), newStatus: s.enum_(values) }),
		job,
	);

	if (!parsed.success) {
		ctx.exit(
			`Invalid ${job.monitorType} status transition: ${job.previousStatus} → ${job.newStatus}`,
		);
	}

	return { previous: parsed.value.previousStatus, current: parsed.value.newStatus };
}

export default createJobHandler(jobs.notify, async (ctx) => {
	let mailer = getServiceContainer().get(Mailer);
	ctx.log.set({ monitor: { id: ctx.input.monitorId, type: ctx.input.monitorType } });

	try {
		let dispatched = await dispatch(ctx, mailer);

		if (!dispatched) {
			ctx.log.note("monitors.not_found");
			return;
		}
	} catch (error) {
		/** A malformed message is already final; only ack it. */
		if (error instanceof Job.NonRetriable) throw error;
		/**
		 * Per-alert delivery failures are already recorded to `alert_events` by the alert
		 * pipeline, so anything reaching here — D1 being unavailable, in practice — is a
		 * lookup that failed before any decision was made, so a redelivery is the right answer.
		 */
		ctx.log.fail(error);
		ctx.retry({ cause: error });
	}

	ctx.log.set({
		notification: { previous_status: ctx.input.previousStatus, status: ctx.input.newStatus },
	});
});

/**
 * Runs the transition through the matching `notify*` helper. Returning false when the
 * monitor no longer exists is an expected outcome, not a failure to retry, and the row
 * is reloaded because its cached status is already overwritten by the sweep.
 */
async function dispatch(
	ctx: CurrentJobContext & { readonly input: NotifyInput },
	mailer: Mailer,
): Promise<boolean> {
	let db: Database = ctx.database;
	let job = ctx.input;

	switch (job.monitorType) {
		case "tcp": {
			let monitor = await db.findOne(tcpMonitors, { where: { id: job.monitorId } });
			if (!monitor) return false;

			let { previous, current } = parseStatuses(ctx, job, TCP_STATUSES);
			await notifyTcpResult(db, mailer, monitor, previous, {
				status: current,
				responseTimeMs: monitor.last_response_time_ms,
			});
			return true;
		}

		case "dns": {
			let monitor = await db.findOne(dnsMonitors, { where: { id: job.monitorId } });
			if (!monitor) return false;

			let { previous, current } = parseStatuses(ctx, job, DNS_STATUSES);

			/**
			 * The findings are reloaded from the record table rather than carried in the
			 * message, since a status alone would leave a redelivered email with a headline and
			 * no body, and a copy on the queue would be replayed as fact however long it sat.
			 */
			let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);
			await notifyDnsResult(
				db,
				mailer,
				monitor,
				previous,
				dnsAlertResultFromRecords(current, records),
			);
			return true;
		}

		case "cron": {
			let monitor = await db.findOne(cronJobMonitors, { where: { id: job.monitorId } });
			if (!monitor) return false;

			let { previous, current } = parseStatuses(ctx, job, cronJobStatuses);
			await notifyCronJobResult(db, mailer, monitor, previous, current);
			return true;
		}

		case "flow": {
			let monitor = await db.findOne(flowMonitors, { where: { id: job.monitorId } });
			if (!monitor) return false;

			let { previous, current } = parseStatuses(ctx, job, flowStatuses);

			/**
			 * The failing assertion is reloaded from the run's own history row rather than
			 * carried in the message, so a redelivery quotes what the check actually recorded
			 * instead of a copy that has been sitting on the queue.
			 */
			let [result] = await FlowMonitor.listResults(db, monitor.id, 1);
			await notifyFlowResult(
				db,
				mailer,
				monitor,
				previous,
				flowAlertResultFromResult(current, result),
			);
			return true;
		}

		case "ssl": {
			let monitor = await db.findOne(monitors, { where: { id: job.monitorId } });
			if (!monitor) return false;

			let { current } = parseStatuses(ctx, job, SSL_STATUSES);

			/**
			 * Recomputed rather than carried in the message: `shouldAlertOnSslStatus` keys off
			 * how many days are left, and the answer is a property of the certificate's expiry
			 * date, not of the transition.
			 */
			let { daysUntilExpiry } = calculateSslStatus(
				monitor.ssl_expires_at,
				monitor.ssl_expiry_warning_days,
			);

			await notifySslResult(db, mailer, monitor, current, daysUntilExpiry);
			return true;
		}
	}
}
