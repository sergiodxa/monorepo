/**
 * Data-access model for HTTP monitors. Exposes CRUD over the `monitors` table scoped
 * to a team, triggering an on-demand check via the `PING` workflow, and the scheduling
 * query the `scheduled` handler uses every minute to find monitors due for a check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";

import type { InsertMonitor } from "~/database/schema";

import { monitors } from "~/database/schema";

/** A monitor due for a check, with the team owner id the usage/billing gate needs. */
export interface DueMonitor {
	monitorId: string;
	ownerId: string;
}

export default class Monitor {
	/** Creates a monitor for a team, enabled immediately. */
	static async create(db: Database, teamId: string, authorId: string, input: InsertMonitor) {
		return await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				author_id: authorId,
				enabled_at: Date.now(),
				...input,
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(monitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Counts a team's monitors. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(monitors, { where: { team_id: teamId } });
	}

	/** Finds a single monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(monitors, { where: { id: monitorId, team_id: teamId } });
	}

	/** Updates a monitor's editable fields. */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertMonitor>) {
		return await db.update(monitors, monitorId, changes, { touch: true });
	}

	/** Deletes a monitor. */
	static async deleteById(db: Database, monitorId: string) {
		return await db.delete(monitors, monitorId);
	}

	/** Starts a `PING` workflow instance for an on-demand or scheduled check. */
	static async ping(monitorId: string) {
		let instanceId = `${monitorId}-${Date.now()}`;
		return await env.PING.create({ id: instanceId, params: { monitorId } });
	}

	/**
	 * Finds every enabled monitor due for a check: one whose interval has elapsed since
	 * its last completed result (or that has never completed one). Runs as a single
	 * query joining the monitor's team owner and latest `monitor_results` row, since
	 * checking each monitor individually would be an N+1 query every minute.
	 */
	static async findDue(db: Database, scheduledAt: number): Promise<DueMonitor[]> {
		let result = await db.exec(
			`SELECT m.id AS monitorId, t.owner_id AS ownerId
			 FROM monitors m
			 JOIN teams t ON t.id = m.team_id
			 LEFT JOIN (
			   SELECT monitor_id, MAX(completed_at) AS last_completed_at
			   FROM monitor_results
			   WHERE completed_at IS NOT NULL
			   GROUP BY monitor_id
			 ) r ON r.monitor_id = m.id
			 WHERE m.enabled_at IS NOT NULL
			   AND (r.last_completed_at IS NULL OR r.last_completed_at + (m.interval_seconds * 1000) <= ?)`,
			[scheduledAt],
		);

		return (result.rows ?? []) as unknown as DueMonitor[];
	}
}
