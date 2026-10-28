/**
 * Answers `list_glossary`: every published term, alphabetically, so a model can scan for
 * the one it needs before reading it with `get_glossary_term`.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { published } from "~/app/mcp/glossary";
import toolset from "~/app/mcp/tools";

/** Lists every published term with its slug. */
export default createTool(toolset.listGlossary, async (ctx) => {
	let entries = await published(ctx.models);

	return {
		total: entries.length,
		terms: entries
			.map((entry) => ({ term: entry.meta.term, slug: entry.meta.slug }))
			.sort((left, right) => left.term.localeCompare(right.term)),
	};
});
