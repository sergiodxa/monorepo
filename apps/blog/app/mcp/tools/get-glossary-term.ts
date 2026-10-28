/**
 * Answers `get_glossary_term`: one published term's definition, or a `ToolError` pointing
 * back to `list_glossary` when the slug matches nothing published.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { published } from "~/app/mcp/glossary";
import toolset from "~/app/mcp/tools";

/** Reads one term, or refuses a slug that names nothing published. */
export default createTool(toolset.getGlossaryTerm, async (ctx) => {
	let entries = await published(ctx.models);
	let entry = entries.find((each) => each.meta.slug === ctx.input.slug);

	if (!entry) {
		throw new ToolError(
			`No glossary term has the slug "${ctx.input.slug}". Call list_glossary to see every term.`,
		);
	}

	return {
		term: entry.meta.term,
		slug: entry.meta.slug,
		title: entry.meta.title,
		definition: entry.meta.definition,
	};
});
