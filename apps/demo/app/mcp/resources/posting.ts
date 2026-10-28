/**
 * How the `jobs://postings/:id` resource answers: the picker lists the newest open positions
 * and a read returns one as Markdown, or `null` so the client reports an unknown id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { toEntry, toMarkdown } from "~/app/mcp/postings";
import resourceset from "~/app/mcp/resources";

/** How many positions the resource picker lists. */
const PICKER_SIZE = 50;

export default createResource(resourceset.posting, {
	list: async (ctx) => (await ctx.models.postings.listOpen(PICKER_SIZE)).map(toEntry),

	read: async (ctx) => {
		let posting = await ctx.models.postings.find(ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});
