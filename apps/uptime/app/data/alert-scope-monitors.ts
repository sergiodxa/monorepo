/**
 * Resolves an alert scope against the monitors a team actually owns: the per-type lookup
 * the alert forms use to offer choices, and the per-type existence check the form action
 * and the API both run before storing a scope.
 *
 * Separate from `~/app/lib/alert-scope`, which stays import-free so the views can render
 * scope options; everything here reaches into the four monitor tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type { AlertScope, AlertScopeType } from "~/app/lib/alert-scope";

import CronJob from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { ALERT_SCOPE_TYPES } from "~/app/lib/alert-scope";

/** One monitor as a scope choice needs it: enough to name it and to store it. */
export interface ScopeMonitor {
	id: string;
	name: string;
}

/** Every team's monitors of one type, as scope choices, in the order the forms list them. */
export interface ScopeMonitorGroup {
	monitorType: AlertScopeType;
	monitors: ScopeMonitor[];
}

/**
 * The four monitor models behind the four scope types.
 *
 * They share a `listByTeam`/`findByIdForTeam` signature, so the whole per-type branch is
 * this table plus an index — a `switch` in each of the three call sites would say the same
 * thing three times and go stale one at a time.
 */
const SCOPE_MONITOR_MODELS: Record<
	AlertScopeType,
	{
		listByTeam(db: Database, teamId: string): Promise<ScopeMonitor[]>;
		findByIdForTeam(db: Database, teamId: string, monitorId: string): Promise<ScopeMonitor | null>;
	}
> = {
	http: Monitor,
	dns: DnsMonitor,
	tcp: TcpMonitor,
	cron: CronJob,
};

/**
 * Every monitor the team can scope an alert to, grouped by type, with empty types kept
 * out — a group whose only content would be its own heading tells a reader nothing.
 */
export async function listScopeMonitors(
	db: Database,
	teamId: string,
): Promise<ScopeMonitorGroup[]> {
	let groups = await Promise.all(
		ALERT_SCOPE_TYPES.map(async (monitorType) => ({
			monitorType,
			monitors: await SCOPE_MONITOR_MODELS[monitorType].listByTeam(db, teamId),
		})),
	);

	return groups.filter((group) => group.monitors.length > 0);
}

/**
 * Whether `scope` names something the team still owns.
 *
 * A team-wide or type-wide scope is always storable — a type with no monitors yet is a
 * standing instruction for the ones that come later, not an error. A monitor-scoped one is
 * checked against that type's own table, so an id belonging to another type or another
 * team is rejected instead of stored as a scope that can never match.
 */
export async function isResolvableScope(
	db: Database,
	teamId: string,
	scope: AlertScope,
): Promise<boolean> {
	if (scope.monitorType === null || scope.monitorId === null) return true;

	let monitor = await SCOPE_MONITOR_MODELS[scope.monitorType].findByIdForTeam(
		db,
		teamId,
		scope.monitorId,
	);

	return monitor !== null;
}
