/**
 * MCP tool answering `list_bookmarks`.
 *
 * A bookmark is only a title and somebody else's URL, so a single tool response holds it
 * in full.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { getDatabase } from "~/app/http/middleware/database";
import toolset from "~/app/mcp/tools";
import { Post } from "~/app/repositories/post";
import { LikePost } from "~/app/repositories/posts/like";

/**
 * Lists bookmarked links, newest first, paged.
 *
 * A row with an unparseable date sorts last, so every bookmark still appears in the page.
 */
export default createTool(toolset.bookmarks, async (ctx) => {
	let bookmarks = await LikePost.findAll(getDatabase(ctx));

	let published = bookmarks
		.filter((bookmark) => Post.isPublishedAt(bookmark.published_at))
		.map((bookmark) => {
			let timestamp = Post.timestampFromPublishedOrCreated(bookmark);

			return {
				title: bookmark.meta.title,
				url: bookmark.meta.url,
				timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
			};
		})
		.sort((left, right) => right.timestamp - left.timestamp);

	let page = published.slice(ctx.input.offset, ctx.input.offset + ctx.input.limit);

	return {
		total: published.length,
		offset: ctx.input.offset,
		bookmarks: page.map((bookmark) => ({
			title: bookmark.title,
			url: bookmark.url,
			bookmarkedAt: bookmark.timestamp === 0 ? null : new Date(bookmark.timestamp).toISOString(),
		})),
	};
});
