/**
 * Enqueues the `notify` queue messages the monitor sweeps produce (ADR-008). A status
 * transition detected by a sweep hands the notification off to the queue instead of
 * dispatching it inline, which keeps an HTTPS round trip to the email provider and the
 * alert pipeline's D1 lookups off the critical path of every sweep — and means a
 * provider outage delays notifications instead of stalling the sweep that detects them.
 *
 * The message deliberately carries only ids and statuses; the consumer reloads the
 * monitor row to build the alert's snapshot. See `app/jobs/notify.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { SslStatus } from "~/app/services/ssl-info";
import type { TcpCheckStatus } from "~/app/services/tcp-check";
import type { CronJobStatus, FlowStatus } from "~/database/schema";

import jobs from "~/app/jobs";
import { enqueueMany } from "~/app/lib/queue";

/** Monitor kinds whose sweeps hand notification off to the queue. */
export type NotifyMonitorType = "dns" | "tcp" | "cron" | "flow" | "ssl";

/**
 * One monitor's status transition, as it travels over the queue — a stable contract with
 * messages already in flight, where only added fields stay compatible. A domain monitor's
 * message stays two statuses; the consumer rereads `dns_monitor_records` for detail.
 */
export type NotifyMessage =
	| {
			monitorType: "tcp";
			monitorId: string;
			previousStatus: TcpCheckStatus | null;
			newStatus: TcpCheckStatus;
	  }
	| {
			monitorType: "dns";
			monitorId: string;
			previousStatus: DnsCheckStatus | null;
			newStatus: DnsCheckStatus;
	  }
	| {
			monitorType: "cron";
			monitorId: string;
			previousStatus: CronJobStatus | null;
			newStatus: CronJobStatus;
	  }
	| {
			monitorType: "flow";
			monitorId: string;
			previousStatus: FlowStatus | null;
			newStatus: FlowStatus;
	  }
	| {
			monitorType: "ssl";
			monitorId: string;
			previousStatus: SslStatus | null;
			newStatus: SslStatus;
	  };

/**
 * Enqueues every notification a sweep produced. Sending nothing is a no-op, so callers
 * don't have to guard an empty sweep.
 */
export async function enqueueNotifications(messages: NotifyMessage[]): Promise<void> {
	await enqueueMany(jobs.notify, messages);
}
