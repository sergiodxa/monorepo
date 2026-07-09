/**
 * Data-access model for alerts. Exposes CRUD over the `alerts` table scoped to a team
 * and the query `app/services/alerts.ts` uses to resolve which alerts apply to a given
 * check result. `monitor_id` scoping only ever applies to HTTP monitors — the `alerts`
 * table predates DNS/TCP/cron-job monitors and has no `monitor_type` column to
 * disambiguate which monitor table a non-null `monitor_id` would point into, so DNS,
 * TCP, and cron-job checks only ever match team-wide alerts (`monitor_id IS NULL`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, isNull, or } from "remix/data-table";

import type { InsertAlert } from "~/database/schema";

import { alerts } from "~/database/schema";

/** Per-team limit from `docs/alerts.md`. */
export const MAX_ALERTS_PER_TEAM = 10;

export default class Alert {
	/** Creates an alert for a team. */
	static async create(db: Database, teamId: string, input: InsertAlert) {
		return await db.create(
			alerts,
			{ id: crypto.randomUUID(), team_id: teamId, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every alert for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(alerts, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Counts a team's alerts, for the {@link MAX_ALERTS_PER_TEAM} limit. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(alerts, { where: { team_id: teamId } });
	}

	/** Finds a single alert scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, alertId: string) {
		return await db.findOne(alerts, { where: { id: alertId, team_id: teamId } });
	}

	/** Updates an alert's editable fields. */
	static async updateById(db: Database, alertId: string, changes: Partial<InsertAlert>) {
		return await db.update(alerts, alertId, changes, { touch: true });
	}

	/** Deletes an alert. */
	static async deleteById(db: Database, alertId: string) {
		return await db.delete(alerts, alertId);
	}

	/**
	 * Finds the alerts applicable to an HTTP monitor's check result: the team's
	 * monitor-specific alert for it, plus every team-wide alert.
	 */
	static async listForHttpMonitor(db: Database, teamId: string, monitorId: string) {
		return await db.findMany(alerts, {
			where: and(eq("team_id", teamId), or(eq("monitor_id", monitorId), isNull("monitor_id"))),
		});
	}

	/** Finds the team-wide alerts applicable to a DNS, TCP, or cron-job check result. */
	static async listTeamWide(db: Database, teamId: string) {
		return await db.findMany(alerts, { where: { team_id: teamId, monitor_id: null } });
	}
}
