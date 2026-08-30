/**
 * Assembles the blog's MCP server: binds every declared tool and resource to its handler
 * and exposes one `fetch` for `bootstrap/app.tsx` to mount.
 *
 * The same split as `bootstrap/app.tsx` — `app/mcp/tools.ts` and `app/mcp/resources.ts`
 * declare what exists, `app/mcp/controllers/**` implements it, and the wiring lives here.
 * Every post this server can reach is already public as HTML, so any client can read it
 * directly here too — the openness this server exists to provide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@pkg/mcp";

import { cacheToolResults } from "~/app/mcp/cache";
import bookmarks from "~/app/mcp/controllers/bookmarks";
import glossary from "~/app/mcp/controllers/glossary";
import { articleResource, postsController, tutorialResource } from "~/app/mcp/controllers/posts";
import searchPosts from "~/app/mcp/controllers/search";
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
	/** Wraps every tool call directly, the one place its result is visible to cache. */
	toolMiddleware: [cacheToolResults()],
});

mcp.tools.map(toolset.searchPosts, searchPosts);
mcp.tools.map(toolset.posts, postsController);
mcp.tools.map(toolset.glossary, glossary);
mcp.tools.map(toolset.bookmarks, bookmarks);

mcp.resources.map(resourceset.article, articleResource);
mcp.resources.map(resourceset.tutorial, tutorialResource);

export default mcp;
