/**
 * Background job that sweeps every enabled DNS monitor once per run on a fixed
 * hourly cadence — DNS monitors are not staggered by their individual
 * `interval_seconds`, unlike HTTP monitors. Resolves each domain, classifies the
 * result, records it via `DnsMonitor.recordCheckResult`, and enqueues a `notify` message
 * for a changed/error result or a recovery back to ok.
 *
 * Monitors are resolved in bounded-concurrency batches rather than one at a time, and
 * alerts are dispatched by the `notify` consumer rather than inline, so the sweep's wall
 * time is no longer the sum of every lookup plus every email send it triggers (ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckStatus, DnsRecordType } from "~/app/services/dns-check";
import type { SelectDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyDnsResult } from "~/app/services/alerts";
import { checkDns } from "~/app/services/dns-check";

export class CheckDnsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let monitors = await DnsMonitor.listEnabled(db);

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
			this.logger.error("job.check_dns.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);

		this.logger.info("job.check_dns.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			notified: notifications.length,
		});
	}

	/**
	 * Resolves one monitor and records its result, returning the notification its outcome
	 * warrants or `null` when it isn't alert-worthy. The previous status is read before
	 * the write, since that's what makes a recovery detectable.
	 */
	private async check(db: Database, monitor: SelectDnsMonitor): Promise<NotifyMessage | null> {
		/** Both columns are declared as plain text enums, so their value sets are asserted here. */
		let previousStatus = monitor.last_status as DnsCheckStatus | null;
		let result = await checkDns(
			monitor.domain,
			monitor.record_type as DnsRecordType,
			monitor.expected_value,
			monitor.last_value,
		);

		await DnsMonitor.recordCheckResult(db, monitor.id, result);

		if (!shouldNotifyDnsResult(previousStatus, result.status)) return null;

		return {
			type: "notify",
			monitorType: "dns",
			monitorId: monitor.id,
			previousStatus,
			newStatus: result.status,
		};
	}
}
