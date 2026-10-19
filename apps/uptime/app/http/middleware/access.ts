/**
 * Binds who is asking as `ctx.access`: a team member after `requireTeam`, by the role the
 * membership holds, or an API key after `requireApiKey`, as its team's owner capped by the key's
 * scopes. Each surface answers a refused `requireAbility` the way it always has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access } from "@sdxc/authz/middleware/router";
import { forbidden } from "@sdxc/http/response/html";

import type { UptimeModels } from "~/app/models";
import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import { features } from "~/app/initializers/flags";
import policy, { API_SCOPES, rolesOf, scopeRole } from "~/app/policies/policy";
import { apiChallenge } from "~/app/services/api/metadata";
import { apiProblems, problemInstance } from "~/app/services/api/problems";

/** The scope an `insufficient_scope` answer names for each ability: the first that grants it. */
const SCOPE_FOR_ABILITY = new Map<string, ApiKeyScope>(
	Object.entries(API_SCOPES)
		.reverse()
		.flatMap(([scope, granted]) => granted.map((name) => [name, scope as ApiKeyScope] as const)),
);

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
 * The principal of every team page and form action. A refused admin page or action answers the
 * same 403 page whichever ability it guards.
 */
export const teamAccess = access(policy, {
	roles: (ctx) => rolesOf(ctx.team, ctx.membership),
	facts: { billing: (ctx) => billingOf(ctx.models, ctx.team) },
	onDenied: () => forbidden("You do not have permission to perform this action."),
});

/**
 * The principal of every API request. A refusal answers 403 with a Bearer challenge naming
 * the scope that grants the ability, so a client knows which scope its key lacks.
 */
export const apiAccess = access(policy, {
	roles: ["owner"],
	within: (ctx) => ctx.apiKey.scopes.map(scopeRole),
	facts: {
		billing: (ctx) => billingOf(ctx.models, ctx.apiTeam),
		/**
		 * Evaluated for the calling team, so a rule naming `team.slug` closes the endpoint to one
		 * caller rather than to every caller.
		 */
		flags: async (ctx) => ({
			adhocPingApi: await ctx.flags.get(features.adhocPingApi, {
				context: { targetingKey: ctx.apiTeam.id, team: { slug: ctx.apiTeam.slug } },
			}),
		}),
	},
	onDenied(ctx, refusal) {
		let scope = SCOPE_FOR_ABILITY.get(refusal.ability);
		return apiProblems.forbidden(
			{ detail: `API key does not have ${scope} scope`, instance: problemInstance() },
			{
				headers: {
					"WWW-Authenticate": apiChallenge(ctx.url.origin, {
						error: "insufficient_scope",
						scope: scope === undefined ? [] : [scope],
					}),
				},
			},
		);
	},
});
