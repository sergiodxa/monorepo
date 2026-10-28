/**
 * Answers `list_status_pages`: lists the team's status pages, newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeStatusPage } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Lists the team's statusPages, newest first. */
export default createTool(toolset.listStatusPages, {
	...forAbility(abilities.statusPages.read),
	handler: async (ctx) => {
		let query = ctx.models.statusPages.inTeam(ctx.apiTeam.id);
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeStatusPage, await query.count());
		return {
			statusPages: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
