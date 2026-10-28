/**
 * Answers `create_team_domain`: adds a domain for the team, pending verification.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeTeamDomain } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Adds a domain pending verification. */
export default createTool(toolset.createTeamDomain, {
	...forAbility(abilities.domains.write),
	handler: async (ctx) => {
		let hostname = ctx.input.hostname;
		if (await ctx.models.teamDomains.inTeam(ctx.apiTeam.id).where({ hostname }).first()) {
			throw new ToolError("This domain was already added to the team");
		}
		let teamDomain = unwrap(
			await ctx.models.teamDomains.create({ team_id: ctx.apiTeam.id, hostname }),
		);
		return { teamDomain: serializeTeamDomain(teamDomain) };
	},
});
