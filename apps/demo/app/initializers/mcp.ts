/**
 * The board's MCP server: tools that list, search, read and publish positions, and a resource
 * that reads one in full. `app/mcp/` declares what exists and answers it, and the wiring lives
 * here, built once at module scope, so the router mounts the server as an ordinary route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import postingResource from "~/app/mcp/resources/posting";
import toolset from "~/app/mcp/tools";
import getJob from "~/app/mcp/tools/get-job";
import listJobs from "~/app/mcp/tools/list-jobs";
import publishJob from "~/app/mcp/tools/publish-job";
import searchJobs from "~/app/mcp/tools/search-jobs";

const mcp = createHandler({
	name: "demo-job-board",
	title: "Remix Job Board",
	version: "1.0.0",
	instructions:
		"List the open positions on this job board with list_jobs or search them with search_jobs, read one in full with get_job, and publish a new one with publish_job.",
});

mcp.tools.map(toolset.searchJobs, searchJobs);
mcp.tools.map(toolset.listJobs, listJobs);
mcp.tools.map(toolset.getJob, getJob);
mcp.tools.map(toolset.publishJob, publishJob);
mcp.resources.map(resourceset.posting, postingResource);

export default mcp;
