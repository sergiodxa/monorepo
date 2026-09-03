/**
 * Data-access model for alerts. Exposes CRUD over the `alerts` table scoped to a team
 * and the query `app/services/alerts.ts` uses to resolve which alerts apply to a given
 * check result. Scoping is the `(monitor_type, monitor_id)` pair described in
 * `~/app/lib/monitor-scope`, and it works the same way for every monitor type: an alert
 * watches everything, or one type, or one monitor of one type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";

import type { MonitorScopeType } from "~/app/lib/monitor-scope";
import type { InsertAlert } from "~/database/schema";

import { monitorScopeMatches, storedMonitorScope } from "~/app/lib/monitor-scope";
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
	 * Every alert applicable to a monitor's check result, monitor-scoped rows first so the
	 * specific ones keep precedence. Two concurrent seeks on `alerts_team_monitor_idx` beat an
	 * `OR` SQLite full-scans, and {@link MAX_ALERTS_PER_TEAM} keeps type matching in memory.
	 */
	static async listForMonitor(
		db: Database,
		teamId: string,
		monitorType: MonitorScopeType,
		monitorId: string,
	) {
		let [monitorScoped, unscopedByMonitor] = await Promise.all([
			db.findMany(alerts, { where: { team_id: teamId, monitor_id: monitorId } }),
			db.findMany(alerts, { where: { team_id: teamId, monitor_id: null } }),
		]);

		return [...monitorScoped, ...unscopedByMonitor].filter((alert) =>
			monitorScopeMatches(storedMonitorScope(alert), monitorType, monitorId),
		);
	}
}
