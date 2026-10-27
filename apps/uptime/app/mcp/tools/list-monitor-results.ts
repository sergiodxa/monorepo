/**
 * Answers `list_monitor_results`: paginated check-result history for one HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Paginated check-result history for one HTTP monitor. */
export default createTool(toolset.listMonitorResults, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");

		let page = await Pagination.byKeyset(ctx.models.monitorResults.ofMonitor(ctx.input.monitorId), {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, (row) => ({
			id: row.id,
			responseStatus: row.response_status,
			responseTimeMs: row.response_time_ms,
			completedAt: row.completed_at,
			createdAt: row.created_at,
		}));
		return {
			results: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
		};
	},
});
