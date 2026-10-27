/**
 * Answers `list_cron_jobs`: lists the team's cron-job monitors, newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";
import { Pagination } from "@sdxc/pagination";

import { forAbility } from "~/app/mcp/ability";
import { unwrapPage } from "~/app/mcp/paging";
import { serializeCronJob } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { NEWEST_FIRST } from "~/app/services/pagination";

/** Lists the team's cronJobs, newest first. */
export default createTool(toolset.listCronJobs, {
	...forAbility(abilities.cronJobs.read),
	handler: async (ctx) => {
		let query = ctx.models.cronJobMonitors.inTeam(ctx.apiTeam.id);
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: ctx.input.cursor,
			limit: ctx.input.perPage,
		});
		let result = unwrapPage(page, ctx.input.perPage, serializeCronJob, await query.count());
		return {
			cronJobs: result.items,
			nextCursor: result.nextCursor,
			prevCursor: result.prevCursor,
			perPage: result.perPage,
			total: result.total,
		};
	},
});
