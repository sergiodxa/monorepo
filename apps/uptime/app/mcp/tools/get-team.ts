/**
 * Answers `get_team`: reads the authenticated team's profile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeTeam } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads the calling key's team profile. */
export default createTool(toolset.getTeam, {
	...forAbility(abilities.team.read),
	handler: async (ctx) => ({ team: serializeTeam(ctx.apiTeam) }),
});
