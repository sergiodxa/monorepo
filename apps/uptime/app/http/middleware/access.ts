/**
 * Binds who is asking as `ctx.access`: a team member after `requireTeam`, by the role the
 * membership holds, an API key after `requireApiKey`, as its team's owner capped by the key's
 * scopes, or the operator's key on the operator's endpoints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access } from "@sdxc/authz/middleware/router";
import { forbidden } from "@sdxc/http/response/html";
import { env } from "cloudflare:workers";

import type { UptimeModels } from "~/app/models";
import type { ApiKeyScope, SelectApiKey, SelectTeam } from "~/database/schema";

import { features } from "~/app/initializers/flags";
import policy, { API_SCOPES, rolesOf, scopeRole } from "~/app/policies/policy";
import { hashApiKey } from "~/app/services/api/key";
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
			{
				detail:
					scope === undefined
						? "API key may not perform this action"
						: `API key does not have ${scope} scope`,
				instance: problemInstance(),
			},
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

/**
 * Whether a key is the one the Worker's own scheduler reports its runs with: the operator
 * creates it and sets it as `UPTIME_CRON_API_KEY`, so holding it is holding the operator's
 * access. While the secret is unset, no key is the operator's.
 *
 * @param apiKey - The key `requireApiKey` authenticated.
 */
async function isOperatorKey(apiKey: SelectApiKey): Promise<boolean> {
	let secret = env.UPTIME_CRON_API_KEY;
	if (!secret) return false;
	return apiKey.key_hash === (await hashApiKey(secret));
}

/**
 * The principal of the operator's endpoints, which act on every team at once: the operator's
 * key binds `operator`, and every team's key binds nothing, whatever its scopes, so it is
 * refused with a 403.
 */
export const operatorAccess = access(policy, {
	roles: async (ctx) => ((await isOperatorKey(ctx.apiKey)) ? ["operator"] : []),
	onDenied() {
		return apiProblems.forbidden({
			detail: "Only the operator's API key may use this endpoint",
			instance: problemInstance(),
		});
	},
});
