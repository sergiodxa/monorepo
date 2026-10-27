/**
 * Answers `delete_api_key`: deletes an API key.
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
export default createTool(toolset.deleteApiKey, {
	...forAbility(abilities.apiKeys.write),
	handler: async (ctx) => {
		let apiKeyId = ctx.input.apiKeyId;
		let existing = await ctx.models.apiKeys.inTeam(ctx.apiTeam.id).where({ id: apiKeyId }).first();
		if (!existing) throw new ToolError("API key not found");
		unwrap(await ctx.models.apiKeys.delete(apiKeyId));
		return { deleted: true };
	},
});
