/**
 * Answers `update_team`: updates the team's name and/or logo URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import type { InsertTeam } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeTeam } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Updates the calling key's team name and/or logo. */
export default createTool(toolset.updateTeam, {
	...forAbility(abilities.team.update),
	handler: async (ctx) => {
		let changes: Partial<InsertTeam> = {};
		if (ctx.input.name !== undefined) changes.name = ctx.input.name;
		if (ctx.input.logoUrl !== undefined) changes.logo = ctx.input.logoUrl;

		let team = unwrap(await ctx.models.teams.update(ctx.apiTeam.id, changes));
		return { team: serializeTeam(team) };
	},
});
