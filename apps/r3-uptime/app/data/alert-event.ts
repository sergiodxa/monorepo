/**
 * Data-access model for alert delivery history (`alert_events`): recording outcomes
 * and the cooldown check `app/services/alerts.ts` uses to decide whether an alert may
 * fire again yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, gte } from "remix/data-table";

import type { AlertEventSnapshot, InsertAlertEvent, SelectAlertEvent } from "~/database/schema";

import { alertEvents } from "~/database/schema";

export default class AlertEvent {
	/** Records a delivery outcome (sent, skipped for cooldown, or failed). */
	static async record(
		db: Database,
		input: Omit<InsertAlertEvent, "id" | "created_at" | "sent_at"> & {
			snapshot?: AlertEventSnapshot;
		},
	) {
		return await db.create(
			alertEvents,
			{ id: crypto.randomUUID(), sent_at: Date.now(), ...input },
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
