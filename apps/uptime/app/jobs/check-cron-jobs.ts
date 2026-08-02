/**
 * Background job that sweeps every actionable cron-job monitor once per minute,
 * transitioning `healthy` → `late` once its expected arrival passes, and either
 * `healthy` or `late` → `missed` once its grace period also elapses. Enqueues a `notify`
 * message on every transition into `late`/`missed`, per `docs/cron-job-monitoring.md`.
 *
 * This is the tightest budget of any sweep — one minute — so monitors are evaluated in
 * bounded-concurrency batches and notification is handed to the `notify` consumer instead
 * of dispatched inline. An incident that transitions many monitors at once no longer
 * serialises an email send per monitor inside the sweep, which used to make the system
 * slower to notice further incidents exactly when it mattered most (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { CronJobStatus, SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyCronJobResult } from "~/app/services/alerts";
import { apportionCostByTeam } from "~/app/services/cost";

export class CheckCronJobsJob extends Job {
	/** The "Check Cron Job Monitors" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "70a5dba9-8447-4cc0-a5f6-d0e41dc6b9e5";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let monitors = await CronJobMonitor.listActionable(db);
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

		let settled = await mapWithConcurrency(monitors, (monitor) => this.evaluate(db, monitor, now));

		for (let outcome of settled) {
			if (outcome.ok) {
				if (outcome.value === null) continue;
				transitioned++;
				if (outcome.value.notification !== null) notifications.push(outcome.value.notification);
				continue;
			}

			errorCount++;
			this.logger.error("job.check_cron_jobs.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);

		this.logger.info("job.check_cron_jobs.completed", {
			total: monitors.length,
			transitioned,
			errorCount,
			notified: notifications.length,
		});
	}

	/**
	 * Applies the grace-period arithmetic to one monitor, returning `null` when it stays
	 * where it is. A transition persists the new status and reports the notification it
	 * warrants — with the status the monitor held *before* the update, which is what makes
	 * a recovery detectable. Two batches never touch the same monitor, so running these
	 * concurrently introduces no race the sequential version didn't have.
	 */
	private async evaluate(
		db: Database,
		monitor: SelectCronJobMonitor,
		now: number,
	): Promise<{ notification: NotifyMessage | null } | null> {
		/**
		 * `listActionable` only returns rows with a `next_expected_at`, but narrow again
		 * here so this arithmetic doesn't need a non-null assertion.
		 */
		if (monitor.next_expected_at === null) return null;

		let missedThreshold = monitor.next_expected_at + monitor.grace_period_seconds * 1000;
		let newStatus: CronJobStatus | null = null;

		if (monitor.status === "healthy" && now > monitor.next_expected_at && now <= missedThreshold) {
			newStatus = "late";
		} else if (now > missedThreshold) {
			newStatus = "missed";
		}

		if (newStatus === null) return null;

		let previousStatus = monitor.status;
		await CronJobMonitor.updateStatus(db, monitor.id, newStatus);

		if (!shouldNotifyCronJobResult(previousStatus, newStatus, monitor)) {
			return { notification: null };
		}

		return {
			notification: {
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus,
				newStatus,
			},
		};
	}
}
