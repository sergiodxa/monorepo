/**
 * Answers `list_packages`: every published package grouped by the problem it solves, or the
 * one group a model named, matched without regard to case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "sdxc/mcp/server";

import toolset from "~/app/mcp/tools";
import { listPackageGroups } from "~/app/services/packages";
import { absoluteUrl } from "~/config/constants";
import routes from "~/routes/web";

/** Lists the groups, or refuses an unknown group by naming the ones that exist. */
export default createTool(toolset.listPackages, (ctx) => {
	let groups = listPackageGroups();
	let requested = ctx.input.group;

	if (requested !== undefined) {
		let wanted = requested.toLowerCase();
		let matching = groups.filter((group) => group.title.toLowerCase() === wanted);

		if (matching.length === 0) {
			let known = groups.map((group) => group.title).join(", ");
			throw new ToolError(`No group called "${requested}". The groups are: ${known}.`);
		}

		groups = matching;
	}

	return groups.map((group) => ({
		group: group.title,
		packages: group.packages.map((entry) => ({
			name: entry.name,
			description: entry.description,
			url: absoluteUrl(routes.api.show.href({ name: entry.directory })),
		})),
	}));
});
