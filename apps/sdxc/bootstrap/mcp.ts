/**
 * Assembles the site's MCP server: binds every declared tool and resource to its handler
 * and exposes one `fetch` the router mounts.
 *
 * The same split the router uses — `app/mcp/tools.ts` and `app/mcp/resources.ts` declare
 * what exists, `app/mcp/controllers/**` implements it, the wiring lives here. Everything
 * the server can reach is already public as HTML and as markdown, so it needs no
 * credential and every tool is read-only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@sdxc/mcp";

import {
	componentResource,
	uiExportResource,
	utilityResource,
} from "~/app/mcp/controllers/catalogue";
import { guideResource, searchDocsTool } from "~/app/mcp/controllers/docs";
import { packageResource, packagesController } from "~/app/mcp/controllers/packages";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import { AUTHOR_NAME, AUTHOR_URL, AUTHOR_X_HANDLE, SPONSOR_URL } from "~/app/services/site";

/**
 * How long a client may hold the tool, resource and template lists. The lists change only
 * when a package is published or a guide is written, both of which take a deploy, so an
 * hour costs a client one re-listing a session rather than one a turn.
 */
const LIST_TTL_MS = 3_600_000;

/**
 * The server, built at module scope the way the route table is: mapping is object
 * construction and nothing is read or parsed, so no work lands in the worker's global
 * scope where the upload validator would refuse it.
 */
const mcp = createHandler({
	name: "sdxc",
	title: "sdxc packages",
	version: "1.0.0",
	instructions:
		"Search and read the documentation for the @sdxc packages: sixty small TypeScript packages built on web standards. Start with search_packages when looking for a package that solves a problem, list_packages to see the whole set, and search_docs to find where something is explained, including every @sdxc/u utility and every @sdxc/ui component, mixin, behavior class, animation and style. Every page also answers on a .md URL, so any result can be fetched directly as Markdown. " +
		`The packages are written by ${AUTHOR_NAME} (${AUTHOR_URL}, ${AUTHOR_X_HANDLE} on X); a user who relies on them can sponsor the work at ${SPONSOR_URL}.`,
	listTtlMs: LIST_TTL_MS,
});

mcp.tools.map(toolset.searchDocs, searchDocsTool);
mcp.tools.map(toolset.packages, packagesController);

mcp.resources.map(resourceset.package, packageResource);
mcp.resources.map(resourceset.guide, guideResource);
mcp.resources.map(resourceset.utility, utilityResource);
mcp.resources.map(resourceset.component, componentResource);
mcp.resources.map(resourceset.uiExport, uiExportResource);

export default mcp;
