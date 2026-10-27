/**
 * Who may do what in uptime: `member` runs the team's monitoring, `admin` also deletes monitors
 * and manages the team, its members, invites, domains and API keys, and `owner` holds everything
 * of its team. `operator` runs the app, across every team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AbilityName } from "@sdxc/authz";

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import type { SubscriptionState } from "~/app/models/subscriptions";
import type { ApiKeyScope } from "~/database/schema";

import abilities from "~/app/policies/abilities";

/** An ability's dotted name, as a grant spells it. */
type UptimeAbility = AbilityName<typeof abilities>;

/**
 * What each API key scope grants. The first scope listing an ability is the one an
 * `insufficient_scope` answer names, so a refused key learns which scope to add.
 */
export const API_SCOPES: Record<ApiKeyScope, UptimeAbility[]> = {
	"teams:read": ["team.read"],
	"teams:write": ["team.update"],
	"invites:read": ["invites.read"],
	"invites:write": ["invites.write"],
	"team-domains:read": ["domains.read"],
	"team-domains:write": ["domains.write"],
	"monitors:read": ["monitors.read"],
	"monitors:write": ["monitors.write"],
	"monitors:delete": ["monitors.delete"],
	"maintenance:read": ["maintenance.read"],
	"maintenance:write": ["maintenance.write"],
	"dns-monitors:read": ["dnsMonitors.read"],
	"dns-monitors:write": ["dnsMonitors.write"],
	"dns-monitors:delete": ["dnsMonitors.delete"],
	"tcp-monitors:read": ["tcpMonitors.read"],
	"tcp-monitors:write": ["tcpMonitors.write"],
	"tcp-monitors:delete": ["tcpMonitors.delete"],
	"flow-monitors:read": ["flowMonitors.read"],
	"flow-monitors:write": ["flowMonitors.write"],
	"flow-monitors:delete": ["flowMonitors.delete"],
	"alerts:read": ["alerts.read"],
	"alerts:write": ["alerts.write"],
	"status-pages:read": ["statusPages.read"],
	"status-pages:write": ["statusPages.write"],
	"cron-jobs:read": ["cronJobs.read"],
	"cron-jobs:write": ["cronJobs.write"],
	"cron-jobs:delete": ["cronJobs.delete"],
	"cron-jobs:ping": ["cronJobs.ping"],
	"reports:read": ["reports.read"],
	"api-keys:read": ["apiKeys.read"],
	"api-keys:write": ["apiKeys.write"],
	"ping:trigger": ["ping.trigger", "ping.api", "checks.run"],
	/**
	 * Gates the MCP transport only. Tools still claim their own abilities through the
	 * resource scopes above, so a key with `mcp` alone lists and calls nothing.
	 */
	mcp: [],
};

/**
 * The ceiling role standing for one API key scope.
 *
 * @param scope - A scope the key carries.
 */
export function scopeRole(scope: ApiKeyScope): string {
	return `scope:${scope}`;
}

/**
 * The roles a team membership holds: the owner's alone, since `owner` inherits every other,
 * or the role on the membership.
 *
 * @param team - The team, whose `owner_id` names its owner.
 * @param membership - The member's row in that team.
 */
export function rolesOf(
	team: { owner_id: string },
	membership: { subject_id: string; role: string },
): string[] {
	return team.owner_id === membership.subject_id ? ["owner"] : [membership.role];
}

/**
 * A subscription refuses billed checks only when it is known to be `inactive`, so a paying
 * owner whose state cannot be determined still gets their check. The ad-hoc ping API's switch
 * is read for the calling team, and only the API binds it.
 */
const policy = definePolicy(abilities, {
	facts: {
		billing: fact<{ subscription: SubscriptionState }>(),
		flags: fact<{ adhocPingApi: boolean }>({ optional: true }),
	},
	roles: {
		member: [
			allow(
				[
					"monitors.read",
					"monitors.write",
					"dnsMonitors.read",
					"dnsMonitors.write",
					"tcpMonitors.read",
					"tcpMonitors.write",
					"flowMonitors.read",
					"flowMonitors.write",
					"cronJobs.read",
					"cronJobs.write",
					"alerts",
					"maintenance",
					"statusPages",
					"reports",
					"team.read",
					"team.leave",
					"checks.run",
					"ping.trigger",
				],
				{ id: "member" },
			),
		],
		admin: {
			inherits: ["member"],
			grants: [
				allow(
					[
						"monitors.delete",
						"dnsMonitors.delete",
						"tcpMonitors.delete",
						"flowMonitors.delete",
						"cronJobs.delete",
						"team.update",
						"members",
						"invites",
						"domains",
						"apiKeys",
					],
					{ id: "admin" },
				),
			],
		},
		owner: [allow("*", { id: "owner", except: ["stats.backfill"] })],
		operator: [allow("stats.backfill", { id: "operator" })],
		...Object.fromEntries(
			Object.entries(API_SCOPES).map(([scope, granted]) => [
				scopeRole(scope as ApiKeyScope),
				[allow(granted, { id: scopeRole(scope as ApiKeyScope) })],
			]),
		),
	},
	guards: [
		deny(["members.remove", "members.changeRole", "team.leave"], {
			id: "owner-stays",
			when: { op: "eq", field: "member.isOwner", value: true },
			reason: "owner",
		}),
		deny("team.leave", {
			id: "admin-demoted-first",
			when: {
				op: "all",
				of: [
					{ op: "eq", field: "member.role", value: "admin" },
					{ op: "eq", field: "member.isOwner", value: false },
				],
			},
			reason: "admin",
		}),
		deny("checks.run", {
			id: "subscription-inactive",
			when: { op: "eq", field: "billing.subscription", value: "inactive" },
			reason: "subscription",
		}),
		deny("ping.api", {
			id: "adhoc-ping-api-off",
			when: {
				op: "all",
				of: [
					{ op: "exists", field: "flags" },
					{ op: "eq", field: "flags.adhocPingApi", value: false },
				],
			},
			reason: "flag:adhocPingApi",
		}),
	],
});

declare module "@sdxc/authz" {
	/** Types `ctx.access` and every check against uptime's catalog. */
	interface AuthzTypes {
		policy: typeof policy;
	}
}

export default policy;
