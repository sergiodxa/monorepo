/**
 * Status-page helpers shared by MCP tools: load a page with its attached monitor and
 * cron-job id lists in the same camelCase shape the REST show endpoint returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeModels } from "~/app/models";

import { serializeStatusPage } from "~/app/mcp/serialize";
import { encodeId } from "~/app/services/typed-id";

/**
 * Loads a team's status page plus its curated HTTP-monitor and cron-job id lists.
 *
 * @param models - The request's models.
 * @param teamId - The calling key's team.
 * @param statusPageId - The page's UUID.
 */
export async function loadStatusPageWithAttachments(
	models: UptimeModels,
	teamId: string,
	statusPageId: string,
) {
	let statusPage = await models.statusPages.inTeam(teamId).find(statusPageId);
	if (!statusPage) return null;
	let attached = await models.statusPages.getAttachedIds(statusPageId);
	return {
		...serializeStatusPage(statusPage),
		monitors: attached.monitorIds.map((id) => encodeId("mon", id)),
		cronJobs: attached.cronJobIds.map((id) => encodeId("cron", id)),
	};
}
