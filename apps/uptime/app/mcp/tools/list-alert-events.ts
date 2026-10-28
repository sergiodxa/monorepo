/**
 * Answers `list_alert_events`: delivery-event history for one alert.
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

/** Delivery-event history for one alert. */
export default createTool(toolset.listAlertEvents, {
	...forAbility(abilities.alerts.read),
	handler: async (ctx) => {
		let alert = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(ctx.input.alertId);
		if (!alert) throw new ToolError("Alert not found");

		let page = await Pagination.byKeyset(ctx.models.alertEvents.forAlert(ctx.input.alertId), {
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
