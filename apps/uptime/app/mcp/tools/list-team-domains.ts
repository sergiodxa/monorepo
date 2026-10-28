/**
 * Answers `list_team_domains`: lists the team's domains.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeTeamDomain } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Lists the team's teamDomains, newest first. */
export default createTool(toolset.listTeamDomains, {
	...forAbility(abilities.domains.read),
	handler: async (ctx) => {
		let query = ctx.models.teamDomains.inTeam(ctx.apiTeam.id);
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeTeamDomain, await query.count());
		return {
			teamDomains: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
