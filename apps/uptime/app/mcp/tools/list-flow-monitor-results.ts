/**
 * Answers `list_flow_monitor_results`: paginated check-result history for one flow monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { newestFirst } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";

/** Paginated check-result history for one flow monitor. */
export default createTool(toolset.listFlowMonitorResults, {
	...forAbility(abilities.flowMonitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.flowMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.flowMonitorId })
			.first();
		if (!monitor) throw new ToolError("Flow monitor not found");

		let page = await Pagination.byKeyset(
			ctx.models.flowMonitorResults.forMonitor(ctx.input.flowMonitorId),
			{
				orderBy: newestFirst("checked_at"),
				cursor: ctx.input.cursor,
				limit: ctx.input.perPage,
			},
		);
		let result = unwrapPage(page, ctx.input.perPage, (row) => ({
			id: encodeId("flowres", row.id),
			status: row.status,
			testsTotal: row.tests_total,
			testsPassed: row.tests_passed,
			testsFailed: row.tests_failed,
			requestsMade: row.requests_made,
			failedTest: row.failed_test,
			failedAtLine: row.failed_at_line,
			failureDetail: row.failure_detail,
			durationMs: row.duration_ms,
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
