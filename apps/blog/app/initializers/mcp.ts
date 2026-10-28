/**
 * Assembles the blog's MCP server: binds every declared tool and resource to its handler
 * and exposes one `fetch` for the router to mount.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler, lazy } from "@sdxc/mcp/server";

import { cacheToolResults } from "~/app/mcp/cache";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

/**
 * How long a client may cache the tool, resource and template lists. Ten minutes matches
 * how often they actually change — a post publishing — so re-listing every turn would waste
 * context on an unchanged set; every caller sees identical lists, cacheable publicly.
 */
const LIST_TTL_MS = 600_000;

/**
 * The blog's MCP server.
 *
 * Built once at module scope, like the route table in `routes/web.ts`: mapping
 * is pure object construction, complete before any request arrives.
 */
const mcp = createHandler({
	name: "sergiodxa-blog",
	title: "Sergio Xalambrí's blog",
	version: "1.0.0",
	instructions:
		"Search and read the articles, tutorials, glossary entries and bookmarks published on sergiodxa.com. Start with search_posts to find writing on a topic, then get_post to read one in full. Posts are also available as resources, so a reader can attach one directly.",
	listTtlMs: LIST_TTL_MS,
	/**
	 * No tool or resource declares who may see it, so every caller gets the same lists, and
	 * a list stays shareable even though its handlers load on first use.
	 */
	cacheScope: "public",
	/** Wraps every tool call directly, the one place its result is visible to cache. */
	toolMiddleware: [cacheToolResults()],
});

mcp.tools.map(
	toolset.searchPosts,
	lazy(() => import("~/app/mcp/tools/search-posts")),
);
mcp.tools.map(
	toolset.listPosts,
	lazy(() => import("~/app/mcp/tools/list-posts")),
);
mcp.tools.map(
	toolset.getPost,
	lazy(() => import("~/app/mcp/tools/get-post")),
);
mcp.tools.map(
	toolset.listGlossary,
	lazy(() => import("~/app/mcp/tools/list-glossary")),
);
mcp.tools.map(
	toolset.getGlossaryTerm,
	lazy(() => import("~/app/mcp/tools/get-glossary-term")),
);
mcp.tools.map(
	toolset.listBookmarks,
	lazy(() => import("~/app/mcp/tools/list-bookmarks")),
);

mcp.resources.map(
	resourceset.article,
	lazy(() => import("~/app/mcp/resources/article")),
);
mcp.resources.map(
	resourceset.tutorial,
	lazy(() => import("~/app/mcp/resources/tutorial")),
);

export default mcp;
