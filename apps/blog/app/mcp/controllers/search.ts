/**
 * MCP tool answering `search_posts`.
 *
 * Data access stays in the repository layer, so this projects and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { isFailure } from "@sdxc/result";

import toolset from "~/app/mcp/tools";
import { PostSearch } from "~/app/repositories/search";

/**
 * Searches the published corpus, best match first.
 *
 * Answers an empty `results` array when nothing matches, since a query that found nothing
 * is a fact the model should act on. A query holding nothing searchable, or too many words,
 * answers a tool error naming the problem, so the model can rephrase it.
 */
export default createTool(toolset.searchPosts, async (ctx) => {
	let parsed = PostSearch.parse(ctx.input.query);
	if (isFailure(parsed)) {
		let reason = parsed.error.issues[0]?.message ?? "The query holds nothing to search for.";
		throw new ToolError(`${reason} Use a few plain words, or quote a phrase.`);
	}

	let results = await PostSearch.query(ctx.db, {
		query: ctx.input.query,
		kind: ctx.input.kind,
		tag: ctx.input.tag,
		limit: ctx.input.limit,
	});

	return { query: ctx.input.query, count: results.length, results };
});
