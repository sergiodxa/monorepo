/**
 * Answers `list_dns_monitor_records`: lists tracked DNS records for one DNS monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OrderByTuple } from "@sdxc/pagination";

import { createTool, ToolError } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeDnsMonitorRecord } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Alphabetical walk of tracked records, matching the REST list. */
const BY_RECORD_IDENTITY: readonly OrderByTuple[] = [
	["name", "asc"],
	["record_type", "asc"],
	["value", "asc"],
	["id", "asc"],
];

/** Lists tracked DNS records for one DNS monitor. */
export default createTool(toolset.listDnsMonitorRecords, {
	...forAbility(abilities.dnsMonitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.dnsMonitorId })
			.first();
		if (!monitor) throw new ToolError("DNS monitor not found");

		let query = ctx.models.dnsMonitorRecords.forMonitor(ctx.input.dnsMonitorId);
		let page = await Pagination.byKeyset(query, {
			orderBy: BY_RECORD_IDENTITY,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(
			page,
			ctx.input.perPage,
			serializeDnsMonitorRecord,
			await query.count(),
		);
		return {
			records: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
