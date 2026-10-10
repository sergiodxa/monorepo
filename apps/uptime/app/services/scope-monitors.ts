/**
 * Resolves a monitor scope against the monitors a team actually owns: the per-type lookup
 * the alert and maintenance-window forms use to offer choices, and the per-type existence
 * check those form actions and the API both run before storing a scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";
import type { UptimeModels } from "~/app/models";

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
 * The team-scoped query of the model behind each scope type. Every monitor model shares the
 * `inTeam` scope, so the whole per-type branch is this switch, and a new scope type is one case.
 */
function inTeam(models: UptimeModels, monitorType: MonitorScopeType, teamId: string) {
	switch (monitorType) {
		case "http":
			return models.monitors.inTeam(teamId);
		case "dns":
			return models.dnsMonitors.inTeam(teamId);
		case "tcp":
			return models.tcpMonitors.inTeam(teamId);
		case "cron":
			return models.cronJobMonitors.inTeam(teamId);
		case "flow":
			return models.flowMonitors.inTeam(teamId);
	}
}

/**
 * Every monitor the team can scope a rule to, grouped by type, newest first within a type,
 * with empty types kept out — a group whose only content would be its own heading tells a
 * reader nothing.
 */
export async function listScopeMonitors(
	models: UptimeModels,
	teamId: string,
): Promise<ScopeMonitorGroup[]> {
	let groups = await Promise.all(
		MONITOR_SCOPE_TYPES.map(async (monitorType) => {
			let rows: ScopeMonitor[] = await inTeam(models, monitorType, teamId)
				.orderBy("created_at", "desc")
				.all();
			return { monitorType, monitors: rows };
		}),
	);

	return groups.filter((group) => group.monitors.length > 0);
}

/**
 * Whether `scope` names something the team still owns. A team-wide or type-wide scope is
 * always storable, a standing instruction for monitors created later; a monitor-scoped one
 * is checked against that type's own table, so it can only name a monitor the team owns.
 */
export async function isResolvableScope(
	models: UptimeModels,
	teamId: string,
	scope: MonitorScope,
): Promise<boolean> {
	if (scope.monitorType === null || scope.monitorId === null) return true;

	let monitor = await inTeam(models, scope.monitorType, teamId)
		.where({ id: scope.monitorId })
		.first();

	return monitor !== null;
}
