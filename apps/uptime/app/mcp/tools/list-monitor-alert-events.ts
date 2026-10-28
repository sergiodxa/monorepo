/**
 * Answers `list_monitor_alert_events`: alert-delivery history for one HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeAlertEvent } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { newestFirst } from "~/app/services/pagination";

/** Alert-delivery history for one HTTP monitor. */
export default createTool(toolset.listMonitorAlertEvents, {
	...forAbility(abilities.alerts.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");

		let page = await Pagination.byKeyset(ctx.models.alertEvents.forMonitor(ctx.input.monitorId), {
			orderBy: newestFirst("sent_at"),
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeAlertEvent);
		return {
			events: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
		};
	},
});
