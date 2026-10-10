/**
 * Data-access model for alert delivery history (`alert_events`): recording outcomes and
 * settling queued ones, the cooldown and per-incident counts that decide whether an alert
 * fires, and the delivery ref a recovery edits. A `pending` row counts as notified, so a
 * delivery still queued is never duplicated by the next check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid/v4";
import { and, eq, gt, gte, inList, lt, lte, ne, notNull } from "remix/data-table";

import type {
	AlertDeliveryRef,
	AlertEventSnapshot,
	InsertAlertEvent,
	SelectAlertEvent,
} from "~/database/schema";

import { alertEvents } from "~/database/schema";

/** The statuses that mean the alert notified, or will once its queued delivery runs. */
const NOTIFIED_STATUSES = ["sent", "pending"] as const;

export default class AlertEvent {
	/**
	 * Records an outcome: `pending` for a queued delivery, `sent` or `failed` for one made
	 * inline, or one of the `skipped_*` reasons.
	 */
	static async record(
		db: Database,
		input: Omit<InsertAlertEvent, "id" | "created_at" | "sent_at"> & {
			snapshot?: AlertEventSnapshot;
		},
	) {
		return await db.create(
			alertEvents,
			{ id: generateUUID(), sent_at: Date.now(), ...input },
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Whether `alertId` has already fired for `monitorId`+`eventType` within the last
	 * `cooldownMinutes`. A `0` cooldown always returns `false` without querying.
	 */
	static async isInCooldown(
		db: Database,
		alertId: string,
		monitorId: string,
		eventType: SelectAlertEvent["event_type"],
		cooldownMinutes: number,
	): Promise<boolean> {
		if (cooldownMinutes <= 0) return false;

		let since = Date.now() - cooldownMinutes * 60_000;
		let recent = await db.findMany(alertEvents, {
			where: and(
				eq("alert_id", alertId),
				eq("monitor_id", monitorId),
				eq("event_type", eventType),
				inList("status", NOTIFIED_STATUSES),
				gte("sent_at", since),
			),
			limit: 1,
		});

		return recent.length > 0;
	}

	/**
	 * When `alertId` last recorded a recovery for `monitorId`, or `0` when it never has —
	 * which is the lower bound the incident queries below want anyway: everything counts.
	 */
	private static async lastRecoveryAt(
		db: Database,
		alertId: string,
		monitorId: string,
	): Promise<number> {
		let [recovery] = await db.findMany(alertEvents, {
			where: and(eq("alert_id", alertId), eq("monitor_id", monitorId), eq("event_type", "up")),
			orderBy: ["sent_at", "desc"],
			limit: 1,
		});

		return recovery?.sent_at ?? 0;
	}

	/**
	 * Sent notifications for `alertId`+`monitorId`+`eventType` since the pair's last
	 * recovery, capped at `limit`; a `0` marks the incident's first notification. A bounded
	 * read answers the caller's threshold question with one index seek.
	 */
	static async countSentSinceRecovery(
		db: Database,
		alertId: string,
		monitorId: string,
		eventType: SelectAlertEvent["event_type"],
		limit: number,
	): Promise<number> {
		let since = await AlertEvent.lastRecoveryAt(db, alertId, monitorId);

		let sent = await db.findMany(alertEvents, {
			where: and(
				eq("alert_id", alertId),
				eq("monitor_id", monitorId),
				eq("event_type", eventType),
				inList("status", NOTIFIED_STATUSES),
				gt("sent_at", since),
			),
			limit,
		});

		return sent.length;
	}

	/**
	 * Delivery totals for the incident being recovered: every non-recovery event after the
	 * previous recovery, split into notified and held back. The recovery email reports both
	 * so a throttled incident reads as throttled; legacy `skipped_cap` rows count as held back.
	 */
	static async summarizeIncident(
		db: Database,
		alertId: string,
		monitorId: string,
	): Promise<{ sent: number; suppressed: number }> {
		let since = await AlertEvent.lastRecoveryAt(db, alertId, monitorId);

		let incident = and(
			eq("alert_id", alertId),
			eq("monitor_id", monitorId),
			ne("event_type", "up"),
			gt("sent_at", since),
		);

		let [sent, suppressed] = await Promise.all([
			db.count(alertEvents, { where: and(incident, inList("status", NOTIFIED_STATUSES)) }),
			db.count(alertEvents, {
				where: and(incident, inList("status", ["skipped_cooldown", "skipped_cap"])),
			}),
		]);

		return { sent, suppressed };
	}

	/** Finds one event, for the delivery job settling the row it was queued with. */
	static async findById(db: Database, eventId: string) {
		return await db.findOne(alertEvents, { where: { id: eventId } });
	}

	/**
	 * Settles a queued delivery as delivered, keeping where the platform put the message so
	 * a recovery can edit it.
	 *
	 * @param ref - The platform's ref, or `null` when it answers no message id.
	 */
	static async markSent(db: Database, eventId: string, ref: AlertDeliveryRef | null) {
		await db.update(alertEvents, eventId, {
			status: "sent",
			error_message: null,
			delivery_ref: ref,
		});
	}

	/** Settles a queued delivery as failed for good, with the reason the history view shows. */
	static async markFailed(db: Database, eventId: string, errorMessage: string) {
		await db.update(alertEvents, eventId, { status: "failed", error_message: errorMessage });
	}

	/**
	 * The ref of the newest delivered notification of the incident `recovery` closes: after
	 * the previous recovery and before this one. `null` when none landed with a ref, which
	 * sends the recovery as a message of its own.
	 */
	static async refForRecovery(
		db: Database,
		recovery: Pick<SelectAlertEvent, "id" | "alert_id" | "monitor_id" | "sent_at">,
	): Promise<AlertDeliveryRef | null> {
		let [previous] = await db.findMany(alertEvents, {
			where: and(
				eq("alert_id", recovery.alert_id),
				eq("monitor_id", recovery.monitor_id),
				eq("event_type", "up"),
				ne("id", recovery.id),
				lt("sent_at", recovery.sent_at),
			),
			orderBy: ["sent_at", "desc"],
			limit: 1,
		});

		let [notified] = await db.findMany(alertEvents, {
			where: and(
				eq("alert_id", recovery.alert_id),
				eq("monitor_id", recovery.monitor_id),
				ne("event_type", "up"),
				eq("status", "sent"),
				notNull("delivery_ref"),
				gt("sent_at", previous?.sent_at ?? 0),
				lte("sent_at", recovery.sent_at),
			),
			orderBy: ["sent_at", "desc"],
			limit: 1,
		});

		return notified?.delivery_ref ?? null;
	}

	/** Lists the most recent alert-delivery events for a team's alerts, newest first. */
	static async listByAlertIds(db: Database, alertIds: string[], limit: number) {
		if (alertIds.length === 0) return [];

		let { inList } = await import("remix/data-table");
		return await db.findMany(alertEvents, {
			where: inList("alert_id", alertIds),
			orderBy: ["sent_at", "desc"],
			limit,
		});
	}

	/**
	 * One alert's delivery events, as a query for a paging strategy to finish.
	 *
	 * The ordering is left off deliberately: `Pagination.byKeyset()` owns it, because
	 * it needs the sort keys both to seek and to mint the cursor.
	 */
	static eventsByAlertQuery(db: Database, alertId: string) {
		return db.query(alertEvents).where({ alert_id: alertId });
	}

	/** One monitor's delivery events, as a query for a paging strategy to finish. */
	static eventsByMonitorQuery(db: Database, monitorId: string) {
		return db.query(alertEvents).where({ monitor_id: monitorId });
	}
}
