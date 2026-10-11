/**
 * What each of the board's tools does when an agent calls it: search, list and read answer
 * from the postings model, and publish writes a row and queues the confirmation. Declared
 * in `app/mcp/tools.ts`, so a tool added there is a type error here until it is answered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createToolController, ToolError } from "@sdxc/mcp";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { summarize, toMarkdown } from "~/app/mcp/postings";
import toolset from "~/app/mcp/tools";

export default createToolController(toolset, {
	actions: {
		searchJobs: async (ctx) => {
			let found = await ctx.models.postings.search(ctx.input.query, ctx.input.limit);
			return found.map(summarize);
		},

		listJobs: async (ctx) => {
			let open = await ctx.models.postings.listOpen(ctx.input.limit);
			return open.map(summarize);
		},

		getJob: async (ctx) => {
			let posting = await ctx.models.postings.find(ctx.input.id);
			if (posting === null) {
				throw new ToolError("No position has that id. Find one with search_jobs.");
			}
			return toMarkdown(posting);
		},

		/** Publishes the way the submit form does: the row, then the confirmation in the caller's language. */
		publishJob: async (ctx) => {
			let posting = await ctx.models.postings.create(ctx.input);
			if (isFailure(posting)) throw new ToolError("The position could not be published.");

			let postingId = posting.data.id;
			await ctx.jobs.enqueue(jobs.sendConfirmation, { postingId, locale: ctx.locale });

			ctx.log.set({ posting: { id: postingId } });

			return toMarkdown(posting.data);
		},
	},
});
