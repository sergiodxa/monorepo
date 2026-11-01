/**
 * The services a status page form offers, read from the team's scope groups: one flat list of
 * monitors, each tagged with the field its table posts under, and the cron jobs on their own,
 * so the new and edit pages list them in the same order under the same names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScopeMonitor, ScopeMonitorGroup } from "~/app/services/scope-monitors";

/** The field each monitor table posts its ticked ids under, which the actions read back apart. */
const SERVICE_FIELDS = {
	http: "monitor_ids",
	dns: "dns_monitor_ids",
	tcp: "tcp_monitor_ids",
	flow: "flow_monitor_ids",
} as const;

/** A monitor as the services checkbox list renders it. */
export interface StatusPageService extends ScopeMonitor {
	field: (typeof SERVICE_FIELDS)[keyof typeof SERVICE_FIELDS];
}

/**
 * HTTP, DNS, TCP and flow monitors as one list in scope order, newest first within a kind,
 * and the cron jobs apart, since they render as their own checkbox group. Only `id` and
 * `name` reach the form, keeping a flow's spec source off the page.
 *
 * @param groups - The team's monitors grouped by kind.
 */
export function statusPageServices(groups: ReadonlyArray<ScopeMonitorGroup>): {
	monitors: StatusPageService[];
	cronJobs: ScopeMonitor[];
} {
	let monitors: StatusPageService[] = [];
	let cronJobs: ScopeMonitor[] = [];

	for (let group of groups) {
		let rows = group.monitors.map(({ id, name }) => ({ id, name }));
		if (group.monitorType === "cron") cronJobs = rows;
		else {
			let field = SERVICE_FIELDS[group.monitorType];
			monitors.push(...rows.map((row) => ({ ...row, field })));
		}
	}

	return { monitors, cronJobs };
}
