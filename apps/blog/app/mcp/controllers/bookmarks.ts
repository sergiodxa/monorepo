/**
 * MCP tool answering `list_bookmarks`.
 *
 * A bookmark is a title, somebody else's URL and that page's short description, so a single
 * tool response holds it in full.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";
import { Post } from "~/app/repositories/post";
import { LikePost } from "~/app/repositories/posts/like";

/**
 * Lists bookmarked links, newest first, paged, each named as `/bookmarks` names it and with
 * its description always present, an empty string when it has none. A row with an
 * unparseable date sorts last, so every bookmark still appears in the page.
 */
export default createTool(toolset.bookmarks, async (ctx) => {
	let bookmarks = await LikePost.findAll(ctx.db);

	let published = bookmarks
		.filter((bookmark) => Post.isPublishedAt(bookmark.published_at))
		.map((bookmark) => {
			let timestamp = Post.timestampFromPublishedOrCreated(bookmark);

			return {
				title: LikePost.label(bookmark.meta),
				url: bookmark.meta.url,
				description: bookmark.meta.description.trim(),
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
			description: bookmark.description,
			bookmarkedAt: bookmark.timestamp === 0 ? null : new Date(bookmark.timestamp).toISOString(),
		})),
	};
});
