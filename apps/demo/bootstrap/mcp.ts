/**
 * The board's MCP server: one tool that searches open positions and one resource that reads
 * a position in full. `app/mcp/` declares what exists and the wiring lives here, the same
 * split `bootstrap/app.tsx` makes, so the server mounts on the router as an ordinary route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@sdxc/mcp";

import Job from "~/app/data/posting";
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
		"Search the open positions on this job board with search_jobs, then read one in full through the posting resource it points at.",
});

mcp.tools.map(toolset.searchJobs, async (ctx) => {
	let found = await Job.search(ctx.db, ctx.input.query, ctx.input.limit);
	return found.map(summarize);
});

mcp.resources.map(resourceset.posting, {
	list: async (ctx) => (await Job.listOpen(ctx.db, PICKER_SIZE)).map(toEntry),

	read: async (ctx) => {
		let posting = await Job.find(ctx.db, ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});

export default mcp;
