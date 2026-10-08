/**
 * Who may do what in the reader: one role per tier, one ceiling role per agent scope, and
 * the operational switches as guards. Numeric limits stay in `TIER_LIMITS`, keyed by the
 * same tier names the roles here carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Condition } from "@sdxc/authz";

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import type { AgentScope } from "~/database/schema";

import abilities from "~/app/authz/abilities";

/**
 * The reason every switch guard reports, so a caller tells a feature turned off for
 * everybody apart from one the reader's plan does not carry.
 */
export const SWITCHED_OFF = "switched-off";

/**
 * The flags a guard reads, by the property name `features` gives each one. A switch that
 * is off refuses its abilities for every tier at once.
 */
export interface Switches {
	savedPosts: boolean;
	tags: boolean;
	filterRules: boolean;
	articleExtraction: boolean;
}

/**
 * The ceiling role an agent token binds under, so the token's scope caps what the
 * reader's tier allows and never widens it.
 *
 * @param scope - The scope the token was minted with.
 * @example policy.for({ roles: [tier], within: [agentRole("read")] });
 */
export function agentRole(scope: AgentScope): `agent:${AgentScope}` {
	return `agent:${scope}`;
}

/**
 * Whether a switch reads off. Only an explicit `false` refuses, so a flag answering its
 * own default keeps the feature on.
 *
 * @param name - The switch, by its property name in `features`.
 */
function off(name: keyof Switches): Condition {
	return { op: "eq", field: `flags.${name}`, value: false };
}

/**
 * Every tier role grants what the tier below it does and more, so an upgrade never
 * removes an ability. A role per agent scope is only ever bound as `within`.
 */
export default definePolicy(abilities, {
	facts: { flags: fact<Switches>() },
	everyone: [allow(["posts.keep", "rules.apply"], { id: "everyone" })],
	roles: {
		free: [],
		paid: [allow(["tags.label", "rules.write", "articles.extract", "agent"], { id: "tier-paid" })],
		premium: { inherits: ["paid"], grants: [allow("digests.email", { id: "tier-premium" })] },
		"agent:read": [allow("agent.connect", { id: "scope-read" })],
		"agent:write": [allow("agent", { id: "scope-write" })],
	},
	guards: [
		deny("posts.keep", { id: "switch-saved-posts", when: off("savedPosts"), reason: SWITCHED_OFF }),
		deny("tags.label", { id: "switch-tags", when: off("tags"), reason: SWITCHED_OFF }),
		deny("rules", { id: "switch-filter-rules", when: off("filterRules"), reason: SWITCHED_OFF }),
		deny("articles.extract", {
			id: "switch-article-extraction",
			when: off("articleExtraction"),
			reason: SWITCHED_OFF,
		}),
	],
});
