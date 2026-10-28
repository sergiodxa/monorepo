/**
 * Answers `get_uptime_daily`: daily uptime rows over a UTC day range, paged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { pageDailyRows, readReportFilter, serializeDailyRow } from "~/app/mcp/reports";
import toolset from "~/app/mcp/tools";
import { dailyRows } from "~/app/models/reports";
import abilities from "~/app/policies/abilities";

/** Daily uptime rows for the calling key's team, paged by the report's own order. */
export default createTool(toolset.getUptimeDaily, {
	...forAbility(abilities.reports.read),
	handler: async (ctx) => {
		let filter = await readReportFilter(ctx.models, ctx.apiTeam.id, ctx.input);
		let page = await pageDailyRows(
			dailyRows(ctx.db, ctx.apiTeam.id, filter),
			ctx.input.cursor,
			ctx.input.perPage,
		);
		return {
			from: filter.from,
			to: filter.to,
			days: page.items.map(serializeDailyRow),
			nextCursor: page.nextCursor,
			prevCursor: page.prevCursor,
			perPage: ctx.input.perPage,
		};
	},
});
