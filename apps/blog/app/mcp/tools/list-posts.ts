/**
 * Answers `list_posts`: one collection, newest first, paged, each post carrying the URL a
 * citation needs.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { listItem } from "~/app/mcp/posts";
import toolset from "~/app/mcp/tools";

/** Lists one collection's published posts, newest first, from the requested offset. */
export default createTool(toolset.listPosts, async (ctx) => {
	let items =
		ctx.input.type === "articles"
			? await ctx.models.articles.listItems({ includePreview: false })
			: await ctx.models.tutorials.listItems({ includePreview: false });

	let page = items.slice(ctx.input.offset, ctx.input.offset + ctx.input.limit);

	return {
		type: ctx.input.type,
		total: items.length,
		offset: ctx.input.offset,
		posts: page.map((item) => listItem(ctx.input.type, item)),
	};
});
