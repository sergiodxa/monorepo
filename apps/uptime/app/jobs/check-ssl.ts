/**
 * Daily background job that re-evaluates SSL certificate status for every HTTP
 * monitor with SSL monitoring enabled. Workers can't read certificate details
 * from `fetch()`, so it re-runs `calculateSslStatus` against the manually
 * entered expiry date, keeping status transitions and expiry-warning alerts
 * on schedule. Monitors run in bounded-concurrency batches; alerts go to the `notify` consumer (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { apportionCostByTeam } from "~/app/services/cost";
import { calculateSslStatus, shouldAlertOnSslStatus } from "~/app/services/ssl-info";

export class CheckSslJob extends Job {
	/** The "Check SSL Certificates" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "2140cbc2-e18e-441c-9ef9-3d516a9e3a19";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let monitors = await Monitor.listSslEnabled(db);
		apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

		let notifications: NotifyMessage[] = [];
		let successCount = 0;
		let errorCount = 0;

		let settled = await mapWithConcurrency(monitors, (monitor) => this.check(db, monitor));

		for (let outcome of settled) {
			if (outcome.ok) {
				successCount++;
				if (outcome.value !== null) notifications.push(outcome.value);
				continue;
			}

			errorCount++;
			this.logger.error("job.check_ssl.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);

		this.logger.info("job.check_ssl.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			notified: notifications.length,
		});
	}

	/**
	 * Re-evaluates one monitor's certificate status and persists it, returning
	 * the notification the new status warrants, or `null` when none applies.
	 * `shouldAlertOnSslStatus` fires every day a warning threshold covers; a per-alert cooldown bounds the repetition.
	 */
	private async check(db: Database, monitor: SelectMonitor): Promise<NotifyMessage | null> {
		let previousStatus = monitor.ssl_status;
		let { status, daysUntilExpiry } = calculateSslStatus(
			monitor.ssl_expires_at,
			monitor.ssl_expiry_warning_days,
		);

		await Monitor.updateById(db, monitor.id, {
			ssl_status: status,
			ssl_last_checked_at: Date.now(),
		});

		if (!shouldAlertOnSslStatus(status, daysUntilExpiry)) return null;

		return {
			type: "notify",
			monitorType: "ssl",
			monitorId: monitor.id,
			previousStatus,
			newStatus: status,
		};
	}
}
