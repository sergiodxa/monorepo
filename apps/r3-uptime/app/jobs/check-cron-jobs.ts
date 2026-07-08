/**
 * Background job that sweeps every actionable cron-job monitor once per minute,
 * transitioning `healthy` → `late` once its expected arrival passes, and either
 * `healthy` or `late` → `missed` once its grace period also elapses. Dispatches
 * alerts on every transition into `late`/`missed`, per `docs/cron-job-monitoring.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { CronJobStatus } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { notifyCronJobResult } from "~/app/services/alerts";

export class CheckCronJobsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let resend = getServiceContainer().get(Resend);
		let monitors = await CronJobMonitor.listActionable(db);
		let now = Date.now();

		let transitioned = 0;

		for (let monitor of monitors) {
			// `listActionable` only returns rows with a `next_expected_at`, but narrow again
			// here so this loop's arithmetic doesn't need a non-null assertion.
			if (monitor.next_expected_at === null) continue;

			let missedThreshold = monitor.next_expected_at + monitor.grace_period_seconds * 1000;
			let newStatus: CronJobStatus | null = null;

			if (
				monitor.status === "healthy" &&
				now > monitor.next_expected_at &&
				now <= missedThreshold
			) {
				newStatus = "late";
			} else if (now > missedThreshold) {
				newStatus = "missed";
			}

			if (newStatus !== null) {
				await CronJobMonitor.updateStatus(db, monitor.id, newStatus);
				await notifyCronJobResult(db, resend, monitor, monitor.status, newStatus);
				transitioned++;
			}
		}

		this.logger.info("job.check_cron_jobs.completed", {
			total: monitors.length,
			transitioned,
		});
	}
}
