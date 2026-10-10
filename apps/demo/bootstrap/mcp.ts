/**
 * The board's MCP server: tools that list, search, read and publish positions, and a resource
 * that reads one in full. `app/mcp/` declares what exists and the wiring lives here, the same split
 * `bootstrap/app.tsx` makes, so the server mounts on the router as an ordinary route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler, ToolError } from "@sdxc/mcp";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { summarize, toEntry, toMarkdown } from "~/app/mcp/postings";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

/** How many positions the resource picker lists. */
const PICKER_SIZE = 50;

const mcp = createHandler({
	name: "demo-job-board",
	title: "Remix Job Board",
	version: "1.0.0",
	instructions:
		"List the open positions on this job board with list_jobs or search them with search_jobs, read one in full with get_job, and publish a new one with publish_job.",
});

mcp.tools.map(toolset.searchJobs, async (ctx) => {
	let found = await ctx.models.postings.search(ctx.input.query, ctx.input.limit);
	return found.map(summarize);
});

mcp.tools.map(toolset.listJobs, async (ctx) => {
	let open = await ctx.models.postings.listOpen(ctx.input.limit);
	return open.map(summarize);
});

mcp.tools.map(toolset.getJob, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.input.id);
	if (posting === null) throw new ToolError("No position has that id. Find one with search_jobs.");
	return toMarkdown(posting);
});

/** Publishes the way the submit form does: the row, then the confirmation in the caller's language. */
mcp.tools.map(toolset.publishJob, async (ctx) => {
	let posting = await ctx.models.postings.create(ctx.input);
	if (isFailure(posting)) throw new ToolError("The position could not be published.");

	let postingId = posting.data.id;
	await ctx.jobs.enqueue(jobs.sendConfirmation, { postingId, locale: ctx.locale });

	ctx.log.set({ posting: { id: postingId } });

	return toMarkdown(posting.data);
});

mcp.resources.map(resourceset.posting, {
	list: async (ctx) => (await ctx.models.postings.listOpen(PICKER_SIZE)).map(toEntry),

	read: async (ctx) => {
		let posting = await ctx.models.postings.find(ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});

export default mcp;
