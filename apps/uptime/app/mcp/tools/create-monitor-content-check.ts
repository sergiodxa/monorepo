/**
 * Answers `create_monitor_content_check`: adds a content check to one HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeContentCheck } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Creates a content check on one HTTP monitor. */
export default createTool(toolset.createMonitorContentCheck, {
	...forAbility(abilities.monitors.write),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");

		let contentCheck = unwrap(
			await ctx.models.contentChecks.create({
				monitor_id: ctx.input.monitorId,
				type: ctx.input.type,
				value: ctx.input.value,
				case_sensitive: ctx.input.caseSensitive,
				is_enabled: ctx.input.isEnabled,
			}),
		);
		return { contentCheck: serializeContentCheck(contentCheck) };
	},
});
