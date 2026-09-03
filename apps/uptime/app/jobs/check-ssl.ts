/**
 * Daily background job that re-evaluates SSL certificate status for every HTTP
 * monitor with SSL monitoring enabled. Workers can't read certificate details
 * from `fetch()`, so it re-runs `calculateSslStatus` against the manually
 * entered expiry date, keeping status transitions and expiry-warning alerts
 * on schedule. Monitors run in bounded-concurrency batches; alerts go to the `notify` job (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createJobHandler } from "@pkg/jobs";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { apportionCostByTeam } from "~/app/services/cost";
import { calculateSslStatus, shouldAlertOnSslStatus } from "~/app/services/ssl-info";

export default createJobHandler(jobs.checkSsl, async (ctx) => {
	let monitors = await Monitor.listSslEnabled(ctx.database);
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let notifications: NotifyMessage[] = [];
	let successCount = 0;
	let errorCount = 0;

	let settled = await mapWithConcurrency(monitors, (monitor) => check(ctx.database, monitor));

	for (let outcome of settled) {
		if (outcome.ok) {
			successCount++;
			if (outcome.value !== null) notifications.push(outcome.value);
			continue;
		}

		errorCount++;
		ctx.logger.error("job.check_ssl.monitor_failed", {
			monitorId: outcome.item.id,
			error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
		});
	}

	await enqueueNotifications(notifications);

	ctx.logger.info("job.check_ssl.completed", {
		total: monitors.length,
		successCount,
		errorCount,
		notified: notifications.length,
	});
});

/**
 * Re-evaluates one monitor's certificate status and persists it, returning
 * the notification the new status warrants, or `null` when none applies.
 * `shouldAlertOnSslStatus` fires every day a warning threshold covers; a per-alert cooldown bounds the repetition.
 */
async function check(db: Database, monitor: SelectMonitor): Promise<NotifyMessage | null> {
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
		monitorType: "ssl",
		monitorId: monitor.id,
		previousStatus,
		newStatus: status,
	};
}
