/**
 * The reads and the stamp behind team digests: who is owed one, what a team's monitors did
 * over a window, and the delivery stamp on the membership. Reports come from the daily roll-up,
 * so a digest is one range scan per team, spanning every monitor table at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { getTableName } from "remix/data-table";

import type { DailyStatsMonitorType } from "~/app/models/monitor-daily-stats";
import type { MonitorStatus } from "~/database/schema";

import {
	cronJobMonitors,
	dnsMonitors,
	flowMonitors,
	memberships,
	monitorDailyStats,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** Which digest is being sent, which picks both the window and the stamp. */
export type DigestPeriod = "daily" | "weekly";

/** The kind of monitor a digest lists, as the daily roll-up records it. */
export type DigestMonitorType = DailyStatsMonitorType;

/** One membership owed a digest, projected down to what sending one needs. */
export interface DigestRecipient {
	/** Membership row id, which is what the stamp is written to. */
	id: string;
	/** Team the digest reports on. */
	teamId: string;
	/** The member's OIDC subject, which their address and language are resolved from. */
	subjectId: string;
}

/** One monitor's day, as the roll-up recorded it. */
export interface TeamDigestDay {
	/** The UTC day, as `YYYY-MM-DD`. */
	date: string;
	totalChecks: number;
	successfulChecks: number;
	/** What the day was classified as overall. */
	status: MonitorStatus;
}

/** One of a team's enabled monitors, with whatever days of the window it has. */
export interface TeamDigestMonitor {
	id: string;
	/** Which kind of monitor it is, reported beside the name. */
	type: DigestMonitorType;
	/** Name the team gave it. */
	name: string;
	/** The days it was checked on, oldest first. A day with no checks has no entry. */
	days: TeamDigestDay[];
}

/** The column each period's stamp lives in; the only two values a period can pick. */
const STAMP_COLUMN = {
	daily: "last_daily_digest_at",
	weekly: "last_weekly_digest_at",
} as const satisfies Record<DigestPeriod, string>;

/**
 * Every enabled monitor of every type as one relation of `(id, type, name, team_id)`, shared
 * by both reads so "which monitors count" has one definition and a digest lists what a team
 * runs.
 */
const ENABLED_MONITORS = `
	          SELECT id, 'http' AS type, name, team_id FROM ${getTableName(monitors)} WHERE enabled_at IS NOT NULL
	UNION ALL SELECT id, 'dns'  AS type, name, team_id FROM ${getTableName(dnsMonitors)} WHERE is_enabled = 1
	UNION ALL SELECT id, 'tcp'  AS type, name, team_id FROM ${getTableName(tcpMonitors)} WHERE is_enabled = 1
	UNION ALL SELECT id, 'cron' AS type, name, team_id FROM ${getTableName(cronJobMonitors)} WHERE enabled_at IS NOT NULL
	UNION ALL SELECT id, 'flow' AS type, name, team_id FROM ${getTableName(flowMonitors)} WHERE is_enabled = 1
`;

/** One row of the report query: a monitor, and one of its days or none at all. */
interface MonitorDayRow {
	id: string;
	type: DigestMonitorType;
	name: string;
	date: string | null;
	totalChecks: number | null;
	successfulChecks: number | null;
	status: MonitorStatus | null;
}

/**
 * Every membership owed the given digest, grouped by team, oldest team first. A stamp
 * predating `cutoff` makes a redelivered trigger a no-op; requiring an enabled monitor spares
 * an address lookup for a team with nothing to report. Opt-out is the caller's.
 *
 * @param db - Database handle.
 * @param period - Which digest is being sent.
 * @param cutoff - Instant a stamp must predate to be due again.
 */
export async function listDigestRecipients(
	db: Database,
	period: DigestPeriod,
	cutoff: number,
): Promise<DigestRecipient[]> {
	let result = await db.exec(
		`SELECT m.id AS id, m.team_id AS teamId, m.subject_id AS subjectId
		   FROM ${getTableName(memberships)} m
		  WHERE COALESCE(m.${STAMP_COLUMN[period]}, 0) < ?
		    AND EXISTS (SELECT 1 FROM (${ENABLED_MONITORS}) mon WHERE mon.team_id = m.team_id)
		  ORDER BY m.team_id ASC, m.created_at ASC, m.id ASC`,
		[cutoff],
	);

	return (result.rows ?? []) as unknown as DigestRecipient[];
}

/**
 * Every enabled monitor of one team, with the days of `[since, until]` the roll-up has for it,
 * in the order the email renders them. A monitor with no days is still listed, so the count an
 * email covers matches what the team runs.
 *
 * @param db - Database handle.
 * @param teamId - Team to report on.
 * @param since - First UTC day of the window, as `YYYY-MM-DD`.
 * @param until - Last one, inclusive.
 */
export async function listDigestMonitors(
	db: Database,
	teamId: string,
	since: string,
	until: string,
): Promise<TeamDigestMonitor[]> {
	let result = await db.exec(
		`SELECT mon.id AS id, mon.type AS type, mon.name AS name,
		        s.date AS date, s.total_checks AS totalChecks,
		        s.successful_checks AS successfulChecks, s.status AS status
		   FROM (${ENABLED_MONITORS}) mon
		   LEFT JOIN ${getTableName(monitorDailyStats)} s
		     ON s.monitor_id = mon.id AND s.monitor_type = mon.type
		    AND s.date >= ? AND s.date <= ?
		  WHERE mon.team_id = ?
		  ORDER BY mon.name ASC, mon.id ASC, s.date ASC`,
		[since, until, teamId],
	);

	let rows = (result.rows ?? []) as unknown as MonitorDayRow[];
	let byMonitor = new Map<string, TeamDigestMonitor>();

	for (let row of rows) {
		let key = monitorKey(row);
		let monitor = byMonitor.get(key);
		if (!monitor) {
			monitor = { id: row.id, type: row.type, name: row.name, days: [] };
			byMonitor.set(key, monitor);
		}

		if (row.date === null || row.status === null) continue;

		monitor.days.push({
			date: row.date,
			totalChecks: row.totalChecks ?? 0,
			successfulChecks: row.successfulChecks ?? 0,
			status: row.status,
		});
	}

	return [...byMonitor.values()];
}

/**
 * The key one monitor's rows group under: its type and id together, since the monitor tables
 * generate ids independently and one may reuse another's, the same pair the roll-up records.
 */
function monitorKey(row: Pick<MonitorDayRow, "id" | "type">) {
	return `${row.type}:${row.id}`;
}

/**
 * Stamps one membership's digest, moving its next one to the following run. Call it only after
 * a transport accepted the message, so a refused send stays due for the next delivery of the
 * same day's trigger; an unknown membership id throws.
 *
 * @param db - Database handle.
 * @param membershipId - The membership that was mailed.
 * @param period - Which digest went out.
 * @param sentAt - When it did.
 */
export async function markDigestSent(
	db: Database,
	membershipId: string,
	period: DigestPeriod,
	sentAt: number = Date.now(),
) {
	let values =
		period === "daily" ? { last_daily_digest_at: sentAt } : { last_weekly_digest_at: sentAt };

	return await db.update(memberships, membershipId, values, { touch: true });
}
