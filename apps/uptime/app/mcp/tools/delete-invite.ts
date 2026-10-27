/**
 * Answers `delete_invite`: deletes an invite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one resource by id. */
export default createTool(toolset.deleteInvite, {
	...forAbility(abilities.invites.write),
	handler: async (ctx) => {
		let inviteId = ctx.input.inviteId;
		let existing = await ctx.models.invites.inTeam(ctx.apiTeam.id).where({ id: inviteId }).first();
		if (!existing) throw new ToolError("Invite not found");
		unwrap(await ctx.models.invites.delete(inviteId));
		return { deleted: true };
	},
});
