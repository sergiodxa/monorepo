/**
 * Resolves a monitor scope against the monitors a team actually owns: the per-type lookup
 * the alert and maintenance-window forms use to offer choices, and the per-type existence
 * check those form actions and the API both run before storing a scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";

import CronJob from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { MONITOR_SCOPE_TYPES } from "~/app/lib/monitor-scope";

/** One monitor as a scope choice needs it: enough to name it and to store it. */
export interface ScopeMonitor {
	id: string;
	name: string;
}

/** Every team's monitors of one type, as scope choices, in the order the forms list them. */
export interface ScopeMonitorGroup {
	monitorType: MonitorScopeType;
	monitors: ScopeMonitor[];
}

/**
 * The four monitor models behind the four scope types. They share a
 * `listByTeam`/`findByIdForTeam` signature, so the whole per-type branch is this table
 * plus an index, and a new scope type is one entry here.
 */
const SCOPE_MONITOR_MODELS: Record<
	MonitorScopeType,
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
 * Every monitor the team can scope a rule to, grouped by type, with empty types kept
 * out — a group whose only content would be its own heading tells a reader nothing.
 */
export async function listScopeMonitors(
	db: Database,
	teamId: string,
): Promise<ScopeMonitorGroup[]> {
	let groups = await Promise.all(
		MONITOR_SCOPE_TYPES.map(async (monitorType) => ({
			monitorType,
			monitors: await SCOPE_MONITOR_MODELS[monitorType].listByTeam(db, teamId),
		})),
	);

	return groups.filter((group) => group.monitors.length > 0);
}

/**
 * Whether `scope` names something the team still owns. A team-wide or type-wide scope is
 * always storable, a standing instruction for monitors created later; a monitor-scoped one
 * is checked against that type's own table, so it can only name a monitor the team owns.
 */
export async function isResolvableScope(
	db: Database,
	teamId: string,
	scope: MonitorScope,
): Promise<boolean> {
	if (scope.monitorType === null || scope.monitorId === null) return true;

	let monitor = await SCOPE_MONITOR_MODELS[scope.monitorType].findByIdForTeam(
		db,
		teamId,
		scope.monitorId,
	);

	return monitor !== null;
}
