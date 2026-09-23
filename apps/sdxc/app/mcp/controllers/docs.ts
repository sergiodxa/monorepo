/**
 * The documentation half of the MCP surface: one search over every guide and package
 * reference, and the guides as pickable resources.
 *
 * Search answers with anchors rather than whole pages, because a heading's URL is both
 * the answer to "where is this explained" and the address the page's markdown twin is
 * read from — so a model spends its context on the section it wanted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource, createTool, ToolError } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import { listGuides, readGuide } from "~/app/services/docs";
import { searchDocs } from "~/app/services/search";
import { absoluteUrl } from "~/app/services/site";

/** Answers `search_docs` over the same index the site's own palette filters. */
export const searchDocsTool = createTool(toolset.searchDocs, async (ctx) => {
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

/** Serves every handwritten guide as a resource a person can attach. */
export const guideResource = createResource(resourceset.guide, {
	list: async () => {
		let sections = await listGuides();

		return sections.flatMap((section) =>
			section.guides.map((guide) => ({
				uri: resourceset.guide.href({ slug: guide.slug }),
				name: guide.slug,
				title: guide.frontmatter.title,
				description: guide.frontmatter.description,
			})),
		);
	},

	read: async (ctx) => await readGuide(ctx.variables.slug),
});
