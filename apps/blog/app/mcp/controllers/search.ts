/**
 * MCP tool answering `search_posts`.
 *
 * Data access stays in the repository layer, so this projects and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@pkg/mcp";

import { getDatabase } from "~/app/http/middleware/database";
import toolset from "~/app/mcp/tools";
import { PostSearch } from "~/app/repositories/search";

/**
 * Searches the published corpus.
 *
 * Answers an empty `results` array when nothing matches, since a query that found nothing
 * is a fact the model should act on.
 */
export default createTool(toolset.searchPosts, async (ctx) => {
	let results = await PostSearch.query(getDatabase(ctx), {
		query: ctx.input.query,
		kind: ctx.input.kind,
		tag: ctx.input.tag,
		limit: ctx.input.limit,
	});

	return { query: ctx.input.query, count: results.length, results };
});
