/**
 * Serves one of the reader's posts as a resource, as a template alone. Tens of thousands of
 * posts is what templates exist for, so nothing enumerates them: the reading tools are how
 * a URI is arrived at, and this is how one is read back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { agentStore, reported, toAgentPost } from "~/app/mcp/page";
import resourceset from "~/app/mcp/resources";

/** Reads one post back with the publisher's own link to it. */
export default createResource(resourceset.post, {
	read: async (ctx) => {
		let opened = await agentStore().openPost(ctx.variables.itemId);
		if (opened === null) return reported("post", null);

		return reported(
			"post",
			JSON.stringify(toAgentPost(opened.item, opened.feed?.title ?? ""), null, 2),
		);
	},
});
