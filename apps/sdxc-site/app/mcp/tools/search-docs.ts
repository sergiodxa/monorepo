/**
 * Answers `search_docs` over the same index the site's own palette filters, naming each
 * match's page and heading so a model can fetch it, or its markdown twin, directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "sdxc/mcp";

import toolset from "~/app/mcp/tools";
import { searchDocs } from "~/app/services/search";
import { absoluteUrl } from "~/config/site";

/** Lists the matching sections, or refuses with a hint toward `search_packages`. */
export default createTool(toolset.searchDocs, async (ctx) => {
	let matches = await searchDocs(ctx.input.query, ctx.input.limit);

	if (matches.length === 0) {
		throw new ToolError(
			`Nothing matched "${ctx.input.query}". Try fewer words, or search_packages when looking for a package rather than a guide.`,
		);
	}

	return matches.map((match) => ({
		title: match.title,
		page: match.page,
		section: match.section,
		...(match.summary === undefined ? {} : { summary: match.summary }),
		url: absoluteUrl(match.href),
	}));
});
