/**
 * Background job that sweeps every actionable cron-job monitor once per minute,
 * transitioning `healthy` → `late` once its expected arrival passes, and either
 * `healthy` or `late` → `missed` once its grace period also elapses. Enqueues a `notify`
 * message on every transition into `late`/`missed`, per `docs/cron-job-monitoring.md`.
 *
 * This is the tightest budget of any sweep — one minute — so monitors are evaluated in
 * bounded-concurrency batches, with notifications handed off to the `notify` job for
 * delivery, keeping a burst of transitions from slowing down the sweep itself (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@pkg/jobs-next";

import { createJobHandler } from "@pkg/jobs-next";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { CronJobStatus, SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyCronJobResult } from "~/app/services/alerts";
import { apportionCostByTeam } from "~/app/services/cost";

export default createJobHandler(jobs.checkCronJobs, async (ctx) => {
	let monitors = await CronJobMonitor.listActionable(ctx.database);
	/**
	 * The evaluation sweep produces no billable ping, so its cost has nowhere else to
	 * land: it is split across the teams whose cron monitors were actionable this minute
	 * (ADR-007 §5).
	 */
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let now = Date.now();

	let notifications: NotifyMessage[] = [];
	let transitioned = 0;
	let errorCount = 0;

	let settled = await mapWithConcurrency(monitors, (monitor) => evaluate(ctx, monitor, now));

	for (let outcome of settled) {
		if (outcome.ok) {
			if (outcome.value === null) continue;
			transitioned++;
			if (outcome.value.notification !== null) notifications.push(outcome.value.notification);
			continue;
		}

		errorCount++;
		ctx.logger.error("job.check_cron_jobs.monitor_failed", {
			monitorId: outcome.item.id,
			error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
		});
	}

	await enqueueNotifications(notifications);

	ctx.logger.info("job.check_cron_jobs.completed", {
		total: monitors.length,
		transitioned,
		errorCount,
		notified: notifications.length,
	});
});

/**
 * Applies the grace-period arithmetic to one monitor, returning `null` when it stays
 * where it is. A transition persists the new status and reports the notification with
 * the status the monitor held *before* the update, which is what makes a recovery detectable.
 */
async function evaluate(
	ctx: CurrentJobContext,
	monitor: SelectCronJobMonitor,
	now: number,
): Promise<{ notification: NotifyMessage | null } | null> {
	/**
	 * A row with no expected-arrival time can't be judged, so the sweep repairs it from the
	 * schedule instead of skipping it — closing the gap where such a monitor read healthy
	 * indefinitely because nothing ever forced a next-expected time to exist.
	 */
	if (monitor.next_expected_at === null) {
		let repaired = CronJobMonitor.calculateNextExpected(monitor.cron_expression, monitor.timezone);

		if (repaired === null) {
			/**
			 * An enabled monitor whose expression no longer parses can never be measured,
			 * and nothing else in the system says so; logging it here surfaces the problem.
			 */
			ctx.logger.error("job.check_cron_jobs.unschedulable", {
				monitorId: monitor.id,
				cronExpression: monitor.cron_expression,
			});
			return null;
		}

		await CronJobMonitor.setNextExpected(ctx.database, monitor.id, repaired);
		ctx.logger.info("job.check_cron_jobs.repaired_next_expected", {
			monitorId: monitor.id,
			nextExpectedAt: repaired,
		});
		return null;
	}

	/**
	 * The grace period is the tolerance, so nothing is late until it elapses — matching
	 * the ping endpoint's own `wasOnTime` deadline judgment, so a ping is never on time by
	 * one half of the system and late by the other.
	 */
	let lateThreshold = monitor.next_expected_at + monitor.grace_period_seconds * 1000;
	/**
	 * Missed means the deadline for the *following* occurrence has also passed, computed
	 * from the schedule itself so the meaning holds whether a job runs every minute or once
	 * a week. An unparseable schedule leaves it `null`, keeping the monitor merely late.
	 */
	let followingExpected = CronJobMonitor.calculateNextExpected(
		monitor.cron_expression,
		monitor.timezone,
		new Date(monitor.next_expected_at),
	);
	let missedThreshold =
		followingExpected === null ? null : followingExpected + monitor.grace_period_seconds * 1000;

	let newStatus: CronJobStatus | null = null;

	if (missedThreshold !== null && now > missedThreshold) {
		newStatus = "missed";
	} else if (monitor.status === "healthy" && now > lateThreshold) {
		newStatus = "late";
	}

	if (newStatus === null) return null;

	let previousStatus = monitor.status;
	await CronJobMonitor.updateStatus(ctx.database, monitor.id, newStatus);

	if (!shouldNotifyCronJobResult(previousStatus, newStatus, monitor)) {
		return { notification: null };
	}

	return {
		notification: {
			monitorType: "cron",
			monitorId: monitor.id,
			previousStatus,
			newStatus,
		},
	};
}
