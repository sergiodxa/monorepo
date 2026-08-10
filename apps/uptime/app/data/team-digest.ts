/**
 * The reads and the two writes behind the team digests: who is owed one, what a team's
 * monitors did over a window, and the stamp that says a digest went out.
 *
 * A read model rather than a table. Nothing here owns storage of its own — the recipients
 * come from `memberships`, the report from `monitor_daily_stats`, and the schedule from two
 * columns on the membership row — and it exists as its own module because the digest is the
 * only caller of all three. Putting the four-table monitor union in `Team` would give teams a
 * method about email, and putting the membership schedule in `MonitorDailyStats` would give a
 * stats table a method about people.
 *
 * **The report is read from the daily roll-up, never from the result streams.** `AggregateDailyStatsJob`
 * already reduces every monitor's day to one row, across all four monitor types, so a digest
 * is a range scan over `monitor_daily_stats` — one query per team, whatever the window — where
 * going to the sources would mean an Analytics Engine query for HTTP plus three D1 scans per
 * team and a retention window that no longer reaches back seven days. It also means the digest
 * and the dashboard's uptime bars report the same numbers, because they read the same rows.
 *
 * The window is therefore whole UTC days ending yesterday, and both digests are scheduled after
 * the roll-up that writes them (see `SendTeamDigestsJob`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { getTableName } from "remix/data-table";

import type { DailyStatsMonitorType } from "~/app/data/monitor-daily-stats";
import type { MonitorStatus } from "~/database/schema";

import {
	cronJobMonitors,
	dnsMonitors,
	memberships,
	monitorDailyStats,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** Which digest is being sent, which picks both the window and the stamp. */
export type DigestPeriod = "daily" | "weekly";

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
	/** Checks that ran that day. */
	totalChecks: number;
	/** How many of them passed. */
	successfulChecks: number;
	/** What the day was classified as overall. */
	status: MonitorStatus;
}

/** One of a team's enabled monitors, with whatever days of the window it has. */
export interface TeamDigestMonitor {
	id: string;
	/** Which kind of monitor it is, reported beside the name. */
	type: DailyStatsMonitorType;
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
 * Every monitor a digest reports on, of all four types, as one relation of
 * `(id, type, name, team_id)`.
 *
 * One fragment used by both queries below, so "which monitors count" cannot come to mean two
 * different things — the recipient query asks whether a team has any, and the report query
 * lists them, and a team the first one skipped must not be a team the second would have
 * reported on.
 *
 * Disabled monitors are left out. Nothing checks them, so every day of theirs is a gap, and a
 * digest listing a row of "no data" for a monitor the team switched off months ago would be
 * noise the reader has to re-learn to ignore every morning. `enabled_at IS NOT NULL` and
 * `is_enabled = 1` are the same condition spelled the two ways the tables spell it.
 */
const ENABLED_MONITORS = `
	          SELECT id, 'http' AS type, name, team_id FROM ${getTableName(monitors)} WHERE enabled_at IS NOT NULL
	UNION ALL SELECT id, 'dns'  AS type, name, team_id FROM ${getTableName(dnsMonitors)} WHERE is_enabled = 1
	UNION ALL SELECT id, 'tcp'  AS type, name, team_id FROM ${getTableName(tcpMonitors)} WHERE is_enabled = 1
	UNION ALL SELECT id, 'cron' AS type, name, team_id FROM ${getTableName(cronJobMonitors)} WHERE enabled_at IS NOT NULL
`;

/** One row of the report query: a monitor, and one of its days or none at all. */
interface MonitorDayRow {
	id: string;
	type: DailyStatsMonitorType;
	name: string;
	date: string | null;
	totalChecks: number | null;
	successfulChecks: number | null;
	status: MonitorStatus | null;
}

export default class TeamDigest {
	/**
	 * Every membership owed the given digest, oldest team first.
	 *
	 * Two conditions, and each one is what keeps a send from being wasted. The stamp must
	 * predate `cutoff` — midnight UTC on the day of the run — so a cron trigger delivered twice
	 * or a queue message redelivered after a failure finds nothing left to do. And the team must
	 * have at least one enabled monitor, because a digest of nothing is not worth an email, and
	 * because the member's address is resolved from the auth server one request at a time: a
	 * team skipped here costs no request at all.
	 *
	 * Membership rows are returned whether or not the member wants the email. The opt-out lives
	 * on `user_preferences`, which is a different table and a different unit, and joining it in
	 * would put the same rule in SQL as well as in `UserPreferences.wants` — the job filters
	 * with the one that a test can call.
	 *
	 * The ordering groups each team's members together, which is what lets the job build one
	 * report per team, and ends in the row id so that two memberships written in the same
	 * millisecond still come back in the same order on every run.
	 *
	 * @param db - Database handle.
	 * @param period - Which digest is being sent.
	 * @param cutoff - Instant a stamp must predate to be due again.
	 * @returns One entry per membership, grouped by team by the ordering.
	 */
	static async listDue(
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
	 * Every enabled monitor of one team, with the days of `[since, until]` the roll-up has for
	 * it, in one query. Monitors are ordered by name and each one's days oldest first, which is
	 * the order the email renders them in.
	 *
	 * A monitor with no days at all is still returned, and that is the point of the outer join:
	 * a monitor enabled yesterday, or one whose checks all failed to record, is part of what the
	 * team is running, and an email that counts how many monitors it covers must not quietly
	 * cover fewer than the team has.
	 *
	 * @param db - Database handle.
	 * @param teamId - Team to report on.
	 * @param since - First UTC day of the window, as `YYYY-MM-DD`.
	 * @param until - Last one, inclusive.
	 * @returns One entry per enabled monitor.
	 */
	static async listMonitors(
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
			/**
			 * Keyed on both, because the four monitor tables generate their ids independently and
			 * nothing stops one of them from reusing another's — the stats table records the pair
			 * for the same reason.
			 */
			let key = `${row.type}:${row.id}`;
			let monitor = byMonitor.get(key);
			if (!monitor) {
				monitor = { id: row.id, type: row.type, name: row.name, days: [] };
				byMonitor.set(key, monitor);
			}

			/** The outer join's miss: a monitor with no day in the window, carried with no days. */
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
	 * Stamps one membership's digest, which is what moves its next one to the following run.
	 *
	 * **Call it only after a transport accepted the message.** A send that failed has to stay
	 * due, so the next delivery of the same day's trigger retries it; stamping first would turn
	 * one refused message into a day with no digest at all.
	 *
	 * @param db - Database handle.
	 * @param membershipId - The membership that was mailed.
	 * @param period - Which digest went out.
	 * @param sentAt - When it did.
	 */
	static async markSent(
		db: Database,
		membershipId: string,
		period: DigestPeriod,
		sentAt: number = Date.now(),
	) {
		let values =
			period === "daily" ? { last_daily_digest_at: sentAt } : { last_weekly_digest_at: sentAt };

		return await db.update(memberships, membershipId, values, { touch: true });
	}
}
