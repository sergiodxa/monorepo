/**
 * The board's MCP server: tools that list, search, read and publish positions, and a resource
 * that reads one in full. `app/mcp/` declares what exists and the wiring lives here, the same split
 * `bootstrap/app.tsx` makes, so the server mounts on the router as an ordinary route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler, ToolError } from "@sdxc/mcp";

import Job from "~/app/data/posting";
import jobs from "~/app/jobs";
import { cache, LISTING_KEY } from "~/app/lib/cache";
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
	let found = await Job.search(ctx.db, ctx.input.query, ctx.input.limit);
	return found.map(summarize);
});

mcp.tools.map(toolset.listJobs, async (ctx) => {
	let open = await Job.listOpen(ctx.db, ctx.input.limit);
	return open.map(summarize);
});

mcp.tools.map(toolset.getJob, async (ctx) => {
	let posting = await Job.find(ctx.db, ctx.input.id);
	if (posting === null) throw new ToolError("No position has that id. Find one with search_jobs.");
	return toMarkdown(posting);
});

/** Publishes the way the submit form does: the row, a fresh listing, and the confirmation. */
mcp.tools.map(toolset.publishJob, async (ctx) => {
	let posting = await Job.publish(ctx.db, ctx.input);
	await cache.delete(LISTING_KEY);
	await ctx.jobs.enqueue(jobs.sendConfirmation, { postingId: posting.id, locale: ctx.locale });

	ctx.log.set({ posting: { id: posting.id } });

	return toMarkdown(posting);
});

mcp.resources.map(resourceset.posting, {
	list: async (ctx) => (await Job.listOpen(ctx.db, PICKER_SIZE)).map(toEntry),

	read: async (ctx) => {
		let posting = await Job.find(ctx.db, ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});

export default mcp;
