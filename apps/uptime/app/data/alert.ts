/**
 * Data-access model for alerts. Exposes CRUD over the `alerts` table scoped to a team
 * and the query `app/services/alerts.ts` uses to resolve which alerts apply to a given
 * check result. Scoping is the `(monitor_type, monitor_id)` pair described in
 * `~/app/lib/alert-scope`, and it works the same way for every monitor type: an alert
 * watches everything, or one type, or one monitor of one type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { AlertScopeType } from "~/app/lib/alert-scope";
import type { InsertAlert } from "~/database/schema";

import { alertScopeMatches, storedAlertScope } from "~/app/lib/alert-scope";
import { alerts } from "~/database/schema";

/** Per-team limit from `docs/alerts.md`. */
export const MAX_ALERTS_PER_TEAM = 10;

export default class Alert {
	/** Creates an alert for a team. */
	static async create(db: Database, teamId: string, input: InsertAlert) {
		return await db.create(
			alerts,
			{ id: generateUUID(), team_id: teamId, ...input },
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
	 * Finds every alert applicable to one monitor's check result: the ones scoped to that
	 * exact monitor, the ones scoped to its whole type, and every team-wide alert.
	 *
	 * Deliberately two statements instead of one `monitor_id = ? OR monitor_id IS NULL`
	 * disjunction: SQLite cannot satisfy an `OR` across two different conditions on the
	 * same column with one index scan, so the single-statement form degrades to a full
	 * scan of every alert row of every team. Split, each half is an index seek on
	 * `alerts_team_monitor_idx (team_id, monitor_id)` returning a handful of rows, and
	 * both run concurrently so the extra statement costs no latency.
	 *
	 * The type is then matched in memory rather than by a third statement or a wider
	 * index: a team holds at most {@link MAX_ALERTS_PER_TEAM} alerts, so both seeks
	 * together return a set small enough that filtering it costs nothing measurable.
	 *
	 * Monitor-scoped rows come first so the more specific alerts keep their current
	 * precedence if a caller ever stops treating the list as unordered.
	 */
	static async listForMonitor(
		db: Database,
		teamId: string,
		monitorType: AlertScopeType,
		monitorId: string,
	) {
		let [monitorScoped, unscopedByMonitor] = await Promise.all([
			db.findMany(alerts, { where: { team_id: teamId, monitor_id: monitorId } }),
			db.findMany(alerts, { where: { team_id: teamId, monitor_id: null } }),
		]);

		return [...monitorScoped, ...unscopedByMonitor].filter((alert) =>
			alertScopeMatches(storedAlertScope(alert), monitorType, monitorId),
		);
	}
}
