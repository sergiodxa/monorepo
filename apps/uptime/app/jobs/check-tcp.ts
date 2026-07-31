/**
 * Background job that sweeps every enabled TCP monitor once per run (a fixed 5-minute
 * cadence — TCP monitors are not staggered by their individual `interval_seconds`,
 * matching how `CheckDnsJob` treats DNS monitors). Attempts a raw TCP connection to
 * each host:port, records the outcome via `TcpMonitor.recordCheckResult`, and enqueues a
 * `notify` message for a down/timeout result or a recovery back to up.
 *
 * Monitors are checked in bounded-concurrency batches rather than one at a time, and
 * alerts are dispatched by the `notify` consumer rather than inline, so the sweep's wall
 * time is no longer the sum of every monitor's connection timeout plus every email send
 * it triggers (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { TcpCheckStatus } from "~/app/services/tcp-check";
import type { SelectTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyTcpResult } from "~/app/services/alerts";
import { checkTcpConnection } from "~/app/services/tcp-check";

export class CheckTcpJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let monitors = await TcpMonitor.listEnabled(db);

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
			this.logger.error("job.check_tcp.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);

		this.logger.info("job.check_tcp.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			notified: notifications.length,
		});
	}

	/**
	 * Checks one monitor and records its result, returning the notification its outcome
	 * warrants or `null` when it isn't alert-worthy. The previous status is read before
	 * the write, since that's what makes a recovery detectable.
	 */
	private async check(db: Database, monitor: SelectTcpMonitor): Promise<NotifyMessage | null> {
		/** The column is declared as a plain text enum, so its value set is asserted here. */
		let previousStatus = monitor.last_status as TcpCheckStatus | null;
		let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);

		await TcpMonitor.recordCheckResult(db, monitor.id, result);

		if (!shouldNotifyTcpResult(previousStatus, result.status)) return null;

		return {
			type: "notify",
			monitorType: "tcp",
			monitorId: monitor.id,
			previousStatus,
			newStatus: result.status,
		};
	}
}
