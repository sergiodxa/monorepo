/**
 * The board's MCP server: tools that list, search, read and publish positions, and a resource
 * that reads one in full. `app/mcp/` declares what exists and answers it, and the wiring lives
 * here, built once at module scope, so the router mounts the server as an ordinary route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@sdxc/mcp";

import jobsController from "~/app/mcp/controllers/jobs";
import postingResource from "~/app/mcp/controllers/posting";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

const mcp = createHandler({
	name: "demo-job-board",
	title: "Remix Job Board",
	version: "1.0.0",
	instructions:
		"List the open positions on this job board with list_jobs or search them with search_jobs, read one in full with get_job, and publish a new one with publish_job.",
});

mcp.tools.map(toolset, jobsController);
mcp.resources.map(resourceset.posting, postingResource);

export default mcp;
