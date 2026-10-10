/**
 * MCP tools answering `list_glossary` and `get_glossary_term`.
 *
 * The glossary has no per-term page, so its entries are tools only — there is no URL a
 * resource could address one by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createToolController, ToolError } from "@sdxc/mcp";

import type { BlogModels } from "~/app/models";

import toolset from "~/app/mcp/tools";
import { isPublishedAt } from "~/app/models/post-values";

/**
 * Reads every published glossary entry.
 *
 * The publish filter is applied here because `glossary.findAll()` returns every row,
 * preview entries included.
 */
async function published(models: BlogModels) {
	let entries = await models.glossary.findAll();
	return entries.filter((entry) => isPublishedAt(entry.published_at));
}

/** Answers `list_glossary` and `get_glossary_term`. */
export default createToolController(toolset.glossary, {
	actions: {
		/** Lists every term, alphabetically, so a model can scan for one. */
		list: async (ctx) => {
			let entries = await published(ctx.models);

			return {
				total: entries.length,
				terms: entries
					.map((entry) => ({ term: entry.meta.term, slug: entry.meta.slug }))
					.sort((left, right) => left.term.localeCompare(right.term)),
			};
		},

		/** Reads one term's definition. */
		get: async (ctx) => {
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
		},
	},
});
