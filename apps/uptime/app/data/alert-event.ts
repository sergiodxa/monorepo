/**
 * Data-access model for alert delivery history (`alert_events`): recording outcomes,
 * the cooldown check `app/services/alerts.ts` uses to decide whether an alert may fire
 * again yet, and the per-incident send count that tells it whether the notification it is
 * about to make is the incident's first one, which always goes out, or a repeat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";
import { and, eq, gt, gte, inList, ne } from "remix/data-table";

import type { AlertEventSnapshot, InsertAlertEvent, SelectAlertEvent } from "~/database/schema";

import { alertEvents } from "~/database/schema";

export default class AlertEvent {
	/** Records a delivery outcome (sent, skipped for one of the `skipped_*` reasons, or failed). */
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
				eq("status", "sent"),
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
				eq("status", "sent"),
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
			db.count(alertEvents, { where: and(incident, eq("status", "sent")) }),
			db.count(alertEvents, {
				where: and(incident, inList("status", ["skipped_cooldown", "skipped_cap"])),
			}),
		]);

		return { sent, suppressed };
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

	/** Lists the most recent alert-delivery events for a single alert, newest first. */
	static async listByAlertId(db: Database, alertId: string, limit: number) {
		return await db.findMany(alertEvents, {
			where: { alert_id: alertId },
			orderBy: ["sent_at", "desc"],
			limit,
		});
	}

	/** Lists the most recent alert-delivery events for a single monitor, newest first. */
	static async listByMonitorId(db: Database, monitorId: string, limit: number) {
		return await db.findMany(alertEvents, {
			where: { monitor_id: monitorId },
			orderBy: ["sent_at", "desc"],
			limit,
		});
	}
}
