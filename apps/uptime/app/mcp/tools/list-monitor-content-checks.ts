/**
 * Answers `list_monitor_content_checks`: lists content checks on one HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeContentCheck } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Lists content checks on one HTTP monitor. */
export default createTool(toolset.listMonitorContentChecks, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");

		let query = ctx.models.contentChecks.ofMonitor(ctx.input.monitorId);
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeContentCheck, await query.count());
		return {
			contentChecks: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
