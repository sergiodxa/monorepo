/**
 * The two tools that act on one post, and the two resources a person attaches a post or
 * their whole shelf with.
 *
 * There is no tool reading one post, because a model holding an id already has that post's
 * fields from the page that gave it the id; the resource exists for the person, who has
 * neither until they pick one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource, createToolController, ToolError } from "@sdxc/mcp";

import { mayWrite, requireWriteScope } from "~/app/mcp/agent";
import { agentPage, agentStore, reported, toAgentPost } from "~/app/mcp/page";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

/** Posts the shelf's resource carries, so attaching it costs a page rather than an archive. */
const SAVED_RESOURCE_POSTS = 50;

/** What a writing tool declares about itself, hidden and refused alike for a read token. */
const WRITES = { available: mayWrite, middleware: [requireWriteScope()] };

/** The sentence a tool answers with when the reader holds no such post. */
const NO_SUCH_POST =
	"This reader holds no post with that id. Call read_timeline or search_timeline to find one.";

/** Answers the two tools that act on one post, both of them idempotent. */
export default createToolController(toolset.posts, {
	actions: {
		/** Marks one post read, or puts it back among the unread. */
		markRead: {
			...WRITES,
			handler: async (ctx) => {
				let marked = await agentStore().markRead(ctx.input.itemId, ctx.input.read);
				if (!marked) throw new ToolError(NO_SUCH_POST);

				return { read: ctx.input.read };
			},
		},

		/** Keeps one post, or stops keeping it, refusing rather than evicting a full shelf. */
		save: {
			...WRITES,
			handler: async (ctx) => {
				let kept = await agentStore().saveItem(ctx.input.itemId, ctx.input.saved);

				if (!kept.ok && kept.reason === "not-found") throw new ToolError(NO_SUCH_POST);

				if (!kept.ok) {
					throw new ToolError(
						"This reader's shelf is full, so nothing was kept. They can stop keeping something first.",
					);
				}

				return { saved: kept.saved };
			},
		},
	},
});

/**
 * Serves one of the reader's posts as a resource, as a template alone.
 *
 * Tens of thousands of posts is what templates exist for, so nothing enumerates them: the
 * two reading tools are how a URI is arrived at, and this is how one is read back.
 */
export const postResource = createResource(resourceset.post, {
	read: async (ctx) => {
		let opened = await agentStore().openPost(ctx.variables.itemId);
		if (opened === null) return reported("post", null);

		return reported(
			"post",
			JSON.stringify(toAgentPost(opened.item, opened.feed?.title ?? ""), null, 2),
		);
	},
});

/** Serves the shelf as one concrete resource, handed over whole. */
export const savedResource = createResource(resourceset.saved, {
	read: async () => {
		let page = agentPage(await agentStore().savedQueue({ limit: SAVED_RESOURCE_POSTS }));

		return reported("saved", JSON.stringify(page, null, 2));
	},
});
