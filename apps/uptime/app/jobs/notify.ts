/**
 * Background job that dispatches the alerts for one monitor status transition, off the
 * sweep that detected it (ADR-008). The sweeps enqueue a `notify` message per transition
 * and move on; this job reloads the monitor, rebuilds the alert's snapshot from its
 * cached columns, and hands the transition to the same `notify*` policy every inline
 * caller uses.
 *
 * The queue delivers at least once and there is no commit point to short-circuit on, so
 * this job is deliberately re-runnable rather than exactly-once: the `notify*` policy
 * re-checks whether the transition is alert-worthy at all, `alert_events` records every
 * outcome, and per-alert cooldown bounds what a redelivery can send. A duplicate
 * delivery therefore costs at most one repeated notification inside the cooldown window,
 * never a wrong one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import {
	notifyCronJobResult,
	notifyDnsResult,
	notifySslResult,
	notifyTcpResult,
} from "~/app/services/alerts";
import { calculateSslStatus } from "~/app/services/ssl-info";
import {
	cronJobMonitors,
	cronJobStatuses,
	dnsMonitors,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** The statuses each monitor type's transition can be between. */
const TCP_STATUSES = ["up", "down", "timeout"] as const;
const DNS_STATUSES = ["ok", "changed", "error"] as const;
const SSL_STATUSES = ["unknown", "valid", "expiring", "expired", "error"] as const;

/**
 * The transition to notify about. The statuses are strings here and validated against
 * the set the monitor type allows by {@link parseStatuses}, since a single object schema
 * can't express "these values depend on that field".
 */
const NotifyJobSchema = s.object({
	monitorId: s.string(),
	monitorType: s.enum_(["dns", "tcp", "cron", "ssl"]),
	previousStatus: s.nullable(s.string()),
	newStatus: s.string(),
});

/**
 * Narrows a message's statuses to the value set `values` allows, so each branch below can
 * hand them straight to its `notify*` helper. A status outside that set can only come
 * from a malformed message, which no amount of redelivery will fix.
 */
function parseStatuses<const Values extends readonly [string, ...string[]]>(
	job: NotifyJob.Input,
	values: Values,
): { previous: Values[number] | null; current: Values[number] } {
	let parsed = s.parseSafe(
		s.object({ previousStatus: s.nullable(s.enum_(values)), newStatus: s.enum_(values) }),
		job,
	);

	if (!parsed.success) {
		throw new Job.NonRetriableError(
			`Invalid ${job.monitorType} status transition: ${job.previousStatus} → ${job.newStatus}`,
		);
	}

	return { previous: parsed.value.previousStatus, current: parsed.value.newStatus };
}

export class NotifyJob extends Job {
	static schema = NotifyJobSchema;

	async perform(): Promise<void> {
		let parsed = await validate(this.input, NotifyJob.schema);

		if (isFailure(parsed)) {
			this.logger.error("job.notify.invalid_input", { input: this.input });
			throw new Job.NonRetriableError("Invalid input", { cause: parsed.error });
		}

		let job = parsed.data;
		let db = getServiceContainer().get(Database);
		let resend = getServiceContainer().get(Resend);

		try {
			let dispatched = await this.dispatch(db, resend, job);

			if (!dispatched) {
				this.logger.info("job.notify.monitor_not_found", {
					monitorId: job.monitorId,
					monitorType: job.monitorType,
				});
				return;
			}
		} catch (error) {
			/** A malformed message is already final; only ack it. */
			if (error instanceof Job.NonRetriableError) throw error;
			/**
			 * Per-alert delivery failures are already recorded to `alert_events` by the alert
			 * pipeline itself, so anything reaching here is a lookup that failed before any
			 * decision was made — D1 being unavailable, in practice. Nothing was sent, so a
			 * redelivery is the right answer.
			 */
			this.logger.error("job.notify.failed", {
				monitorId: job.monitorId,
				monitorType: job.monitorType,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Job.RetryError("Alert dispatch failed before any alert was resolved", {
				cause: error,
			});
		}

		this.logger.info("job.notify.completed", {
			monitorId: job.monitorId,
			monitorType: job.monitorType,
			previousStatus: job.previousStatus,
			newStatus: job.newStatus,
		});
	}

	/**
	 * Runs the transition through the matching `notify*` helper, returning false when the
	 * monitor no longer exists — a monitor deleted between the sweep and this job is an
	 * expected outcome, not a failure to retry.
	 *
	 * The row is reloaded rather than carried in the message so the alert's snapshot uses
	 * the monitor's current name and settings. Only the transition's statuses come from the
	 * message, because the row's cached status has already been overwritten by the sweep.
	 */
	private async dispatch(db: Database, resend: Resend, job: NotifyJob.Input): Promise<boolean> {
		switch (job.monitorType) {
			case "tcp": {
				let monitor = await db.findOne(tcpMonitors, { where: { id: job.monitorId } });
				if (!monitor) return false;

				let { previous, current } = parseStatuses(job, TCP_STATUSES);
				await notifyTcpResult(db, resend, monitor, previous, {
					status: current,
					responseTimeMs: monitor.last_response_time_ms,
				});
				return true;
			}

			case "dns": {
				let monitor = await db.findOne(dnsMonitors, { where: { id: job.monitorId } });
				if (!monitor) return false;

				let { previous, current } = parseStatuses(job, DNS_STATUSES);
				await notifyDnsResult(db, resend, monitor, previous, {
					status: current,
					resolvedValue: monitor.last_value,
				});
				return true;
			}

			case "cron": {
				let monitor = await db.findOne(cronJobMonitors, { where: { id: job.monitorId } });
				if (!monitor) return false;

				let { previous, current } = parseStatuses(job, cronJobStatuses);
				await notifyCronJobResult(db, resend, monitor, previous, current);
				return true;
			}

			case "ssl": {
				let monitor = await db.findOne(monitors, { where: { id: job.monitorId } });
				if (!monitor) return false;

				let { current } = parseStatuses(job, SSL_STATUSES);

				/**
				 * Recomputed rather than carried in the message: `shouldAlertOnSslStatus` keys off
				 * how many days are left, and the answer is a property of the certificate's expiry
				 * date, not of the transition.
				 */
				let { daysUntilExpiry } = calculateSslStatus(
					monitor.ssl_expires_at,
					monitor.ssl_expiry_warning_days,
				);

				await notifySslResult(db, resend, monitor, current, daysUntilExpiry);
				return true;
			}
		}
	}
}

export namespace NotifyJob {
	export type Input = s.InferOutput<typeof NotifyJobSchema>;
}
