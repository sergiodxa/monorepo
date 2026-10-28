/**
 * Answers `get_post`: one published post in full, as the Markdown it was written in, or a
 * `ToolError` pointing back to `search_posts` when the slug matches nothing published.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { COLLECTION_PATHS, findPublished } from "~/app/mcp/posts";
import toolset from "~/app/mcp/tools";

/** Reads one published post, or refuses a slug that names a draft or nothing. */
export default createTool(toolset.getPost, async (ctx) => {
	let found = await findPublished(ctx.models, ctx.input.type, ctx.input.slug);
	if (!found || (found.postType !== "articles" && found.postType !== "tutorials")) {
		let noun = ctx.input.type === "articles" ? "article" : "tutorial";
		throw new ToolError(
			`No published ${noun} has the slug "${ctx.input.slug}". Call search_posts or list_posts to find one.`,
		);
	}

	return {
		type: found.postType,
		title: found.post.meta.title,
		slug: found.post.meta.slug,
		url: `${COLLECTION_PATHS[found.postType]}/${found.post.meta.slug}`,
		excerpt: found.post.meta.excerpt,
		tags: found.postType === "tutorials" ? found.tags : [],
		content: found.post.meta.content,
	};
});
