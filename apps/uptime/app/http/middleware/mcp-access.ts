/**
 * Binds `ctx.access` for MCP the same way `apiAccess` does for REST, and preloads every
 * ability a tool may claim so `guard()` can hide tools synchronously on `tools/list`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access } from "@sdxc/authz/middleware/router";

import type { UptimeModels } from "~/app/models";
import type { SelectTeam } from "~/database/schema";

import { features } from "~/app/initializers/flags";
import abilities from "~/app/policies/abilities";
import policy, { scopeRole } from "~/app/policies/policy";

/**
 * The team's subscription as billed checks read it, from the D1 projection.
 *
 * @param models - The request's models.
 * @param team - The team whose owner pays for its checks.
 */
async function billingOf(models: UptimeModels, team: SelectTeam) {
	return { subscription: await models.subscriptions.stateFor(team.owner_id) };
}

/**
 * The principal of every MCP request: the team's owner capped by the key's scopes, with
 * every tool ability loaded so list filtering stays synchronous.
 */
export const mcpAccess = access(policy, {
	roles: ["owner"],
	within: (ctx) => ctx.apiKey.scopes.map(scopeRole),
	facts: {
		billing: (ctx) => billingOf(ctx.models, ctx.apiTeam),
		flags: async (ctx) => ({
			adhocPingApi: await ctx.flags.get(features.adhocPingApi, {
				context: { targetingKey: ctx.apiTeam.id, team: { slug: ctx.apiTeam.slug } },
			}),
		}),
	},
	load: [
		abilities.monitors,
		abilities.dnsMonitors,
		abilities.tcpMonitors,
		abilities.flowMonitors,
		abilities.cronJobs,
		abilities.alerts,
		abilities.maintenance,
		abilities.statusPages,
		abilities.reports,
		abilities.team,
		abilities.invites,
		abilities.domains,
		abilities.apiKeys,
		abilities.ping,
		abilities.checks,
	],
});

export default mcpAccess;
