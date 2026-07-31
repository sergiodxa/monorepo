/**
 * Background job that claims the TCP monitors whose configured `interval_seconds` has come
 * round and checks those, rather than sweeping every enabled monitor on a cadence of its
 * own (ADR-006). Attempts a raw TCP connection to each host:port, records the outcome via
 * `TcpMonitor.recordCheckResult`, and enqueues a `notify` message for a down/timeout result
 * or a recovery back to up.
 *
 * Delivered every minute, which is the finest interval a monitor can be configured with.
 * Running that often is cheaper than the old 5-minute full sweep, not more expensive: the
 * claim is an indexed range that matches nothing in most minutes, and it is also what stops
 * the several deliveries a single minute's cron produces from checking the same monitor
 * more than once.
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

import type { ClaimedTcpMonitor } from "~/app/data/tcp-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { TcpCheckStatus } from "~/app/services/tcp-check";

import TcpMonitor from "~/app/data/tcp-monitor";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyTcpResult } from "~/app/services/alerts";
import { checkTcpConnection } from "~/app/services/tcp-check";

export class CheckTcpJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		/**
		 * Claimed as of now rather than as of the cron's `scheduledTime`: the claim advances
		 * each monitor from its own previous due time, so what this instant decides is only
		 * which monitors are owed a check, and the queue hop between the trigger and here is
		 * seconds. Nothing downstream keys off it, unlike the HTTP sweep's per-minute job id.
		 */
		let monitors = await TcpMonitor.claimDue(db, Date.now());

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
	private async check(db: Database, monitor: ClaimedTcpMonitor): Promise<NotifyMessage | null> {
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
