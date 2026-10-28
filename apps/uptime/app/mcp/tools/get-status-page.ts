/**
 * Answers `get_status_page`: reads one status page with attachment id lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { loadStatusPageWithAttachments } from "~/app/mcp/status-pages";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one status page with its attached monitor and cron-job ids. */
export default createTool(toolset.getStatusPage, {
	...forAbility(abilities.statusPages.read),
	handler: async (ctx) => {
		let statusPage = await loadStatusPageWithAttachments(
			ctx.models,
			ctx.apiTeam.id,
			ctx.input.statusPageId,
		);
		if (!statusPage) throw new ToolError("Status page not found");
		return { statusPage };
	},
});
