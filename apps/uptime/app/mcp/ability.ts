/**
 * Shared MCP ability wiring: one claim both hides a tool from `tools/list` and refuses a
 * call that somehow still reaches it, matching how writing tools declare themselves in
 * apps that already ship an agent surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Ability } from "@sdxc/authz";

import { guard, requireToolAbility } from "@sdxc/authz/mcp";

/** A context-free claim — every API-mirrored ability the tools gate on is one. */
type Claim = Ability<undefined>;

/**
 * Hides a tool from credentials that lack `ability`, and refuses a call the same way.
 *
 * @param ability - The claim the tool performs.
 */
export function forAbility(ability: Claim) {
	return {
		...guard(ability),
		middleware: [requireToolAbility(ability)],
	};
}
