/**
 * Answers `follow_feed`: follows whatever feed a URL leads to and reports the first page
 * that came back with it, or says in a sentence a model can act on why it could not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import type { UserStore } from "~/app/models/user-store";

import { WRITES } from "~/app/mcp/agent";
import { agentStore, toAgentFeed } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/**
 * The sentence a refused follow answers with, written so a model knows what would work.
 *
 * @param reason - What the reader's own object said about the address.
 */
function followFailure(reason: UserStore.FollowFailure): string {
	if (reason === "invalid-url")
		return "That is not an HTTP address, so there is nothing to follow.";
	if (reason === "not-found")
		return "That address was reached, but it advertises no RSS or Atom feed.";
	if (reason === "unreachable") return "That address could not be reached. Try again later.";
	if (reason === "already-following") return "This reader already follows that feed.";

	return "This reader already follows as many feeds as their plan allows.";
}

/** Follows whatever a URL leads to, and reports what came back with it. */
export default createTool(toolset.followFeed, {
	...WRITES,
	handler: async (ctx) => {
		let followed = await agentStore().followFeed(ctx.input.url);

		if (!followed.ok) throw new ToolError(followFailure(followed.reason));

		return { feed: toAgentFeed(followed.feed), posts: followed.items };
	},
});
