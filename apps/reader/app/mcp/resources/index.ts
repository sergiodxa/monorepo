/**
 * The three things a reader can hand their agent directly, declared as URI patterns: one
 * of their feeds, one of their posts, and the shelf of everything they kept.
 *
 * A scheme of this app's own rather than `https://`, because none of these is fetchable:
 * every one belongs to exactly one reader and is reached through `resources/read` rather
 * than by address. A post's contents carry the publisher's own link, which is the address
 * a client can follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@sdxc/mcp";

/** The resource tree the MCP handler is mapped against. */
export default resources({
	feed: resource("reader://feeds/:feedId", {
		name: "feed",
		title: "Followed feed",
		description: "One feed the reader follows, with its newest posts.",
		mimeType: "application/json",
	}),

	post: resource("reader://posts/:itemId", {
		name: "post",
		title: "Post",
		description: "One post from a followed feed, with the publisher's own link to it.",
		mimeType: "application/json",
	}),

	saved: resource("reader://saved", {
		name: "saved",
		title: "Saved posts",
		description: "Everything the reader asked to keep, newest first.",
		mimeType: "application/json",
	}),
});
