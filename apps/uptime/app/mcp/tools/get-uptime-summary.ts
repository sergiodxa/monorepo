/**
 * Answers `get_uptime_summary`: per-monitor uptime summary over a UTC day range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { readReportFilter, serializeSummaryRow } from "~/app/mcp/reports";
import toolset from "~/app/mcp/tools";
import { summaryRows } from "~/app/models/reports";
import abilities from "~/app/policies/abilities";

/** Per-monitor uptime summary for the calling key's team. */
export default createTool(toolset.getUptimeSummary, {
	...forAbility(abilities.reports.read),
	handler: async (ctx) => {
		let filter = await readReportFilter(ctx.models, ctx.apiTeam.id, ctx.input);
		let rows = await summaryRows(ctx.db, ctx.apiTeam.id, filter);
		return {
			from: filter.from,
			to: filter.to,
			monitors: rows.map(serializeSummaryRow),
		};
	},
});
