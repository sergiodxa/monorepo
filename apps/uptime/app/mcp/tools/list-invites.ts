/**
 * Answers `list_invites`: lists every invite for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeInvite } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Lists the team's invites, newest first. */
export default createTool(toolset.listInvites, {
	...forAbility(abilities.invites.read),
	handler: async (ctx) => {
		let query = ctx.models.invites.inTeam(ctx.apiTeam.id);
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeInvite, await query.count());
		return {
			invites: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
