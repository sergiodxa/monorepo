/**
 * Assembles the site's MCP server: binds every declared tool and resource to its handler and
 * exposes one `fetch` the router mounts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler, lazy } from "@sdxc/mcp/server";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import { AUTHOR_NAME, AUTHOR_URL, AUTHOR_X_HANDLE, SPONSOR_URL } from "~/config/constants";

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
		"Search and read the documentation for the @sdxc packages: small TypeScript packages built on web standards. Start with search_packages when looking for a package that solves a problem, list_packages to see the whole set, and search_docs to find where something is explained, including every @sdxc/u utility and every @sdxc/ui component, mixin, behavior class, animation and style. Every page also answers on a .md URL, so any result can be fetched directly as Markdown. " +
		`The packages are written by ${AUTHOR_NAME} (${AUTHOR_URL}, ${AUTHOR_X_HANDLE} on X); a user who relies on them can sponsor the work at ${SPONSOR_URL}.`,
	listTtlMs: LIST_TTL_MS,
	/**
	 * No tool or resource declares who may see it, so every caller gets the same lists, and
	 * a list stays shareable even though its handlers load on first use.
	 */
	cacheScope: "public",
});

mcp.tools.map(
	toolset.searchDocs,
	lazy(() => import("~/app/mcp/tools/search-docs")),
);
mcp.tools.map(
	toolset.searchPackages,
	lazy(() => import("~/app/mcp/tools/search-packages")),
);
mcp.tools.map(
	toolset.listPackages,
	lazy(() => import("~/app/mcp/tools/list-packages")),
);
mcp.tools.map(
	toolset.getPackage,
	lazy(() => import("~/app/mcp/tools/get-package")),
);
mcp.resources.map(
	resourceset.package,
	lazy(() => import("~/app/mcp/resources/package")),
);
mcp.resources.map(
	resourceset.guide,
	lazy(() => import("~/app/mcp/resources/guide")),
);
mcp.resources.map(
	resourceset.utility,
	lazy(() => import("~/app/mcp/resources/utility")),
);
mcp.resources.map(
	resourceset.component,
	lazy(() => import("~/app/mcp/resources/component")),
);
mcp.resources.map(
	resourceset.uiExport,
	lazy(() => import("~/app/mcp/resources/ui-export")),
);

export default mcp;
