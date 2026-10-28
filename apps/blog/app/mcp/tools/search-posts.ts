/**
 * MCP tool answering `search_posts`.
 *
 * Data access stays in the search model, so this projects and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { isFailure } from "@sdxc/result";

import toolset from "~/app/mcp/tools";
import { PostSearch } from "~/app/models/search";

/**
 * Searches the published corpus, best match first unless the query sets `order:`. Answers
 * an empty `results` array when nothing matches, since a query that found nothing is a fact
 * the model should act on.
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
