/**
 * Answers `list_tcp_monitor_results`: paginated check-result history for one TCP monitor.
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
import { newestFirst } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";

/** Paginated check-result history for one TCP monitor. */
export default createTool(toolset.listTcpMonitorResults, {
	...forAbility(abilities.tcpMonitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.tcpMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.tcpMonitorId })
			.first();
		if (!monitor) throw new ToolError("TCP monitor not found");

		let page = await Pagination.byKeyset(
			ctx.models.tcpMonitorResults.forMonitor(ctx.input.tcpMonitorId),
			{
				orderBy: newestFirst("checked_at"),
				cursor: ctx.input.cursor,
				limit: ctx.input.perPage,
			},
		);
		let result = unwrapPage(page, ctx.input.perPage, (row) => ({
			id: encodeId("tcpr", row.id),
			status: row.status,
			responseTimeMs: row.response_time_ms,
			errorMessage: row.error_message,
			checkedAt: row.checked_at,
		}));
		return {
			results: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
		};
	},
});
