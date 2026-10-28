/**
 * Answers `delete_team_domain`: removes a domain by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Removes a team domain by id. */
export default createTool(toolset.deleteTeamDomain, {
	...forAbility(abilities.domains.write),
	handler: async (ctx) => {
		let teamDomain = await ctx.models.teamDomains
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.id })
			.first();
		if (!teamDomain) throw new ToolError("Team domain not found");
		unwrap(await ctx.models.teamDomains.delete(ctx.input.id));
		return { deleted: true };
	},
});
