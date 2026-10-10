/**
 * Alert delivery history: recording outcomes and settling queued ones, the cooldown and
 * per-incident counts that decide whether an alert fires, and the delivery ref a recovery
 * edits. A `pending` row counts as notified, so a queued delivery is never duplicated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { and, eq, gt, gte, inList, lt, lte, ne, notNull } from "remix/data-table";

import type { AlertDeliveryRef, SelectAlertEvent } from "~/database/schema";

import { alertEvents } from "~/database/schema";

/** The statuses that mean the alert notified, or will once its queued delivery runs. */
const NOTIFIED_STATUSES = ["sent", "pending"] as const;

/** What {@link AlertEvents} `record` takes: the outcome, with what the history view shows of it. */
export interface AlertEventOutcome
	extends
		Pick<SelectAlertEvent, "alert_id" | "monitor_id" | "event_type" | "status">,
		Partial<
			Pick<
				SelectAlertEvent,
				"error_message" | "monitor_type" | "monitor_name" | "snapshot" | "delivery_ref"
			>
		> {}

export const AlertEvents = createModel(alertEvents, {
	optional: ["id", "sent_at"],

	scopes: {
		forAlert: (query, alertId: string) => query.where({ alert_id: alertId }),
		forMonitor: (query, monitorId: string) => query.where({ monitor_id: monitorId }),
	},

	methods: {
		/**
		 * Records an outcome: `pending` for a queued delivery, `sent` or `failed` for one made
		 * inline, or one of the `skipped_*` reasons. `sent_at` is the moment of recording.
		 */
		record(values: AlertEventOutcome) {
			return this.create(values);
		},

		/**
		 * Whether `alertId` has already fired for `monitorId`+`eventType` within the last
		 * `cooldownMinutes`. A `0` cooldown answers `false` without querying.
		 */
		async isInCooldown(
			alertId: string,
			monitorId: string,
			eventType: SelectAlertEvent["event_type"],
			cooldownMinutes: number,
		): Promise<boolean> {
			if (cooldownMinutes <= 0) return false;

			let since = Date.now() - cooldownMinutes * 60_000;
			let recent = await this.query()
				.where(
					and(
						eq("alert_id", alertId),
						eq("monitor_id", monitorId),
						eq("event_type", eventType),
						inList("status", NOTIFIED_STATUSES),
						gte("sent_at", since),
					),
				)
				.limit(1)
				.all();

			return recent.length > 0;
		},

		/**
		 * When `alertId` last recorded a recovery for `monitorId`, or `0` when it never has,
		 * which is the lower bound the incident counts want anyway: everything counts.
		 */
		async lastRecoveryAt(alertId: string, monitorId: string): Promise<number> {
			let recovery = await this.query()
				.where(and(eq("alert_id", alertId), eq("monitor_id", monitorId), eq("event_type", "up")))
				.orderBy("sent_at", "desc")
				.first();

			return recovery?.sent_at ?? 0;
		},

		/**
		 * Sent notifications for `alertId`+`monitorId`+`eventType` since the pair's last
		 * recovery, capped at `limit`; a `0` marks the incident's first notification. A bounded
		 * read answers the caller's threshold question with one index seek.
		 */
		async countSentSinceRecovery(
			alertId: string,
			monitorId: string,
			eventType: SelectAlertEvent["event_type"],
			limit: number,
		): Promise<number> {
			let since = await this.lastRecoveryAt(alertId, monitorId);

			let sent = await this.query()
				.where(
					and(
						eq("alert_id", alertId),
						eq("monitor_id", monitorId),
						eq("event_type", eventType),
						inList("status", NOTIFIED_STATUSES),
						gt("sent_at", since),
					),
				)
				.limit(limit)
				.all();

			return sent.length;
		},

		/**
		 * Delivery totals for the incident being recovered: every non-recovery event after the
		 * previous recovery, split into notified and held back. The recovery email reports both
		 * so a throttled incident reads as throttled; legacy `skipped_cap` rows count as held back.
		 */
		async summarizeIncident(
			alertId: string,
			monitorId: string,
		): Promise<{ sent: number; suppressed: number }> {
			let since = await this.lastRecoveryAt(alertId, monitorId);

			let incident = and(
				eq("alert_id", alertId),
				eq("monitor_id", monitorId),
				ne("event_type", "up"),
				gt("sent_at", since),
			);

			let [sent, suppressed] = await Promise.all([
				this.query()
					.where(and(incident, inList("status", NOTIFIED_STATUSES)))
					.count(),
				this.query()
					.where(and(incident, inList("status", ["skipped_cooldown", "skipped_cap"])))
					.count(),
			]);

			return { sent, suppressed };
		},

		/**
		 * Settles a queued delivery as delivered, keeping where the platform put the message so
		 * a recovery can edit it.
		 *
		 * @param ref The platform's ref, or `null` when it answers no message id.
		 */
		markSent(eventId: string, ref: AlertDeliveryRef | null) {
			return this.update(eventId, { status: "sent", error_message: null, delivery_ref: ref });
		},

		/** Settles a queued delivery as failed for good, with the reason the history view shows. */
		markFailed(eventId: string, errorMessage: string) {
			return this.update(eventId, { status: "failed", error_message: errorMessage });
		},

		/**
		 * The ref of the newest delivered notification of the incident `recovery` closes: after
		 * the previous recovery and before this one. `null` when none landed with a ref, which
		 * sends the recovery as a message of its own.
		 */
		async refForRecovery(
			recovery: Pick<SelectAlertEvent, "id" | "alert_id" | "monitor_id" | "sent_at">,
		): Promise<AlertDeliveryRef | null> {
			let previous = await this.query()
				.where(
					and(
						eq("alert_id", recovery.alert_id),
						eq("monitor_id", recovery.monitor_id),
						eq("event_type", "up"),
						ne("id", recovery.id),
						lt("sent_at", recovery.sent_at),
					),
				)
				.orderBy("sent_at", "desc")
				.first();

			let notified = await this.query()
				.where(
					and(
						eq("alert_id", recovery.alert_id),
						eq("monitor_id", recovery.monitor_id),
						ne("event_type", "up"),
						eq("status", "sent"),
						notNull("delivery_ref"),
						gt("sent_at", previous?.sent_at ?? 0),
						lte("sent_at", recovery.sent_at),
					),
				)
				.orderBy("sent_at", "desc")
				.first();

			return notified?.delivery_ref ?? null;
		},

		/**
		 * The most recent delivery events of several alerts, newest first. An empty id list
		 * answers an empty history without querying.
		 */
		async latestForAlerts(alertIds: string[], limit: number): Promise<SelectAlertEvent[]> {
			if (alertIds.length === 0) return [];
			return await this.query()
				.where(inList("alert_id", alertIds))
				.orderBy("sent_at", "desc")
				.limit(limit)
				.all();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID(), sent_at: values.sent_at ?? Date.now() };
		},
	},
});

/** An alert delivery event, as reads return it. */
export type AlertEvent = ModelRow<typeof AlertEvents>;

export default AlertEvents;
