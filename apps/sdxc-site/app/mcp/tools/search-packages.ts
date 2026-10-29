/**
 * Answers `search_packages`: the packages whose name, description or README match what a
 * model described, each with its page and markdown twin so `get_package` or a fetch follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import toolset from "~/app/mcp/tools";
import { searchPackages } from "~/app/services/search";
import { absoluteUrl } from "~/config/constants";

/** Lists the matching packages, or refuses with a hint toward `list_packages`. */
export default createTool(toolset.searchPackages, async (ctx) => {
	let matches = await searchPackages(ctx.input.query, ctx.input.limit);

	if (matches.length === 0) {
		throw new ToolError(
			`No package matched "${ctx.input.query}". Try a broader word, or call list_packages to see the whole set.`,
		);
	}

	return matches.map((match) => ({
		name: match.name,
		description: match.description,
		url: absoluteUrl(match.href),
		markdownUrl: absoluteUrl(match.markdownHref),
	}));
});
