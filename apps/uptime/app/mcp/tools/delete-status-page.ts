/**
 * Answers `delete_status_page`: deletes a status page and its attachments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one resource by id. */
export default createTool(toolset.deleteStatusPage, {
	...forAbility(abilities.statusPages.write),
	handler: async (ctx) => {
		let statusPageId = ctx.input.statusPageId;
		let existing = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
		if (!existing) throw new ToolError("Status page not found");
		unwrap(await ctx.models.statusPages.delete(statusPageId));
		return { deleted: true };
	},
});
