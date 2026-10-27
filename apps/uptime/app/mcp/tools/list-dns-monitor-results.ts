/**
 * Answers `list_dns_monitor_results`: paginated check-result history for one DNS monitor.
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

/** Paginated check-result history for one DNS monitor. */
export default createTool(toolset.listDnsMonitorResults, {
	...forAbility(abilities.dnsMonitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.dnsMonitorId })
			.first();
		if (!monitor) throw new ToolError("DNS monitor not found");

		let page = await Pagination.byKeyset(
			ctx.models.dnsMonitorResults.forMonitor(ctx.input.dnsMonitorId),
			{
				orderBy: newestFirst("checked_at"),
				cursor: ctx.input.cursor,
				limit: ctx.input.perPage,
			},
		);
		let result = unwrapPage(page, ctx.input.perPage, (row) => ({
			id: encodeId("res", row.id),
			status: row.status,
			recordsChecked: row.records_checked,
			recordsChanged: row.records_changed,
			recordsMissing: row.records_missing,
			recordsNew: row.records_new,
			queriesFailed: row.queries_failed,
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
