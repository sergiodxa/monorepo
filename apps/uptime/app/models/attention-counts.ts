/**
 * How many of a team's monitors of each kind need attention right now, read in one statement
 * across every monitor table, so the sidebar can put a count beside each kind on every page
 * for the cost of a single query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { getTableName } from "remix/data-table";

import {
	cronJobMonitors,
	dnsMonitors,
	flowMonitors,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** The monitor kinds the sidebar lists, each with its own page. */
export type AttentionKind = "http" | "dns" | "tcp" | "flow" | "cron";

/** Monitors needing attention per kind; a kind with none reads 0. */
export type AttentionCounts = Record<AttentionKind, number>;

/** One row of the union: a kind and its count. */
interface CountRow {
	kind: AttentionKind;
	count: number;
}

/**
 * Counts, per kind, the monitors whose last result was a failure: an enabled HTTP monitor
 * that is down, a DNS check that errored, a TCP monitor down or timed out, a flow down or
 * errored, and a cron job that missed its window. Paused monitors count for nothing.
 *
 * @param db - The request's database.
 * @param teamId - The team whose monitors are counted.
 */
export async function attentionCounts(db: Database, teamId: string): Promise<AttentionCounts> {
	let result = await db.exec(
		`SELECT 'http' AS kind, COUNT(*) AS count FROM ${getTableName(monitors)}
			WHERE team_id = ? AND enabled_at IS NOT NULL AND last_status = 'down'
		UNION ALL SELECT 'dns', COUNT(*) FROM ${getTableName(dnsMonitors)}
			WHERE team_id = ? AND is_enabled = 1 AND last_status = 'error'
		UNION ALL SELECT 'tcp', COUNT(*) FROM ${getTableName(tcpMonitors)}
			WHERE team_id = ? AND is_enabled = 1 AND last_status IN ('down', 'timeout')
		UNION ALL SELECT 'flow', COUNT(*) FROM ${getTableName(flowMonitors)}
			WHERE team_id = ? AND is_enabled = 1 AND last_status IN ('down', 'error')
		UNION ALL SELECT 'cron', COUNT(*) FROM ${getTableName(cronJobMonitors)}
			WHERE team_id = ? AND enabled_at IS NOT NULL AND status = 'missed'`,
		[teamId, teamId, teamId, teamId, teamId],
	);

	let counts: AttentionCounts = { http: 0, dns: 0, tcp: 0, flow: 0, cron: 0 };
	for (let row of (result.rows ?? []) as unknown as CountRow[])
		counts[row.kind] = Number(row.count);
	return counts;
}
