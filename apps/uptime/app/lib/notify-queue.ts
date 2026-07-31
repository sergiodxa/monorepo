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
import type { CronJobStatus } from "~/database/schema";

import { sendQueueBatch } from "~/app/lib/queue";

/** Monitor kinds whose sweeps hand notification off to the queue. */
export type NotifyMonitorType = "dns" | "tcp" | "cron" | "ssl";

/**
 * One monitor's status transition, as it travels over the queue. The shape is a stable
 * contract with messages already in flight: adding a field is safe, renaming or
 * removing one is not.
 *
 * `previousStatus` is always the value the monitor held *before* the sweep wrote its
 * new one, because that's what decides whether a transition is a recovery.
 */
export type NotifyMessage =
	| {
			type: "notify";
			monitorType: "tcp";
			monitorId: string;
			previousStatus: TcpCheckStatus | null;
			newStatus: TcpCheckStatus;
	  }
	| {
			type: "notify";
			monitorType: "dns";
			monitorId: string;
			previousStatus: DnsCheckStatus | null;
			newStatus: DnsCheckStatus;
	  }
	| {
			type: "notify";
			monitorType: "cron";
			monitorId: string;
			previousStatus: CronJobStatus | null;
			newStatus: CronJobStatus;
	  }
	| {
			type: "notify";
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
	await sendQueueBatch(messages);
}
