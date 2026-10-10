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

import { generateUUID } from "@sdxc/uuid/v4";

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

	/**
	 * A team's alerts, as a query for a paging strategy to finish.
	 *
	 * The ordering is left off deliberately: `Pagination.byKeyset()` owns it, because
	 * it needs the sort keys both to seek and to mint the cursor.
	 */
	static listByTeamQuery(db: Database, teamId: string) {
		return db.query(alerts).where({ team_id: teamId });
	}

	/** Counts a team's alerts, for the {@link MAX_ALERTS_PER_TEAM} limit. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(alerts, { where: { team_id: teamId } });
	}

	/** Finds a single alert scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, alertId: string) {
		return await db.findOne(alerts, { where: { id: alertId, team_id: teamId } });
	}

	/**
	 * Updates an alert's editable fields. Saving a `config` clears the broken mark, since
	 * a channel saved again is the owner's answer to it; the next delivery confirms it.
	 */
	static async updateById(db: Database, alertId: string, changes: Partial<InsertAlert>) {
		let cleared: Partial<InsertAlert> =
			changes.config === undefined ? {} : { broken_at: null, broken_reason: null };
		return await db.update(alerts, alertId, { ...changes, ...cleared }, { touch: true });
	}

	/** Finds an alert by id alone, for the delivery job, which runs outside any team's request. */
	static async findById(db: Database, alertId: string) {
		return await db.findOne(alerts, { where: { id: alertId } });
	}

	/**
	 * Marks the alert's destination as gone, so the alert list tells its owner the channel
	 * stopped existing; `updated_at` stays, since nobody edited the alert.
	 *
	 * @param reason - The platform's own words, shown beside the badge.
	 */
	static async markBroken(db: Database, alertId: string, reason: string) {
		await db.update(alerts, alertId, { broken_at: Date.now(), broken_reason: reason });
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
