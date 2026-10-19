/**
 * Everything a team member or an API key can do in uptime, named once so the page guards, the
 * form actions and the API's scope checks all decide the same ability. The read and write pairs
 * follow the API key scopes one to one. Importing the catalog does no work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { abilities, ability, context } from "@sdxc/authz";

/** The member a remove or role change targets. */
export interface MemberTarget {
	/** Whether this membership belongs to the team's owner, who stays until the team is deleted. */
	isOwner: boolean;
}

/** The membership a viewer leaves with: an admin is demoted before leaving. */
export interface TeamMember extends MemberTarget {
	role: string;
}

/**
 * Every monitor kind's delete sits apart from its write, so an admin alone deletes a monitor
 * and an API key needs that kind's `:delete` scope. `checks.run` is every check billed on demand.
 */
export default abilities({
	monitors: {
		read: ability(),
		write: ability(),
		delete: ability({ description: "Delete an HTTP monitor" }),
	},
	dnsMonitors: {
		read: ability(),
		write: ability(),
		delete: ability({ description: "Delete a DNS monitor" }),
	},
	tcpMonitors: {
		read: ability(),
		write: ability(),
		delete: ability({ description: "Delete a TCP monitor" }),
	},
	flowMonitors: {
		read: ability(),
		write: ability(),
		delete: ability({ description: "Delete a flow monitor" }),
	},
	cronJobs: {
		read: ability(),
		write: ability(),
		delete: ability({ description: "Delete a cron job" }),
		ping: ability({ description: "Report a cron job's run to its ping endpoint" }),
	},
	alerts: { read: ability(), write: ability() },
	maintenance: { read: ability(), write: ability() },
	statusPages: { read: ability(), write: ability() },
	reports: { read: ability() },
	team: {
		read: ability(),
		update: ability({ description: "Open the team's settings and change its name and logo" }),
		delete: ability({ description: "Delete the team and end its subscription" }),
		leave: ability({ context: context<{ member: TeamMember }>("member") }),
	},
	members: {
		manage: ability({ description: "Remove members and change their roles" }),
		remove: ability({ context: context<{ member: MemberTarget }>("member") }),
		changeRole: ability({ context: context<{ member: MemberTarget }>("member") }),
	},
	invites: { read: ability(), write: ability() },
	domains: { read: ability(), write: ability() },
	apiKeys: { read: ability(), write: ability() },
	billing: {
		manage: ability({ description: "Start a checkout for the team's subscription" }),
	},
	checks: {
		run: ability({ description: "Run a billed check now: a manual check or an ad-hoc ping" }),
	},
	ping: {
		trigger: ability({ description: "Run an ad-hoc ping against any target" }),
		api: ability({ description: "Reach the ad-hoc ping API while its switch is on" }),
	},
	stats: {
		backfill: ability({ description: "Enqueue the daily-stats rollup for every team" }),
	},
});
