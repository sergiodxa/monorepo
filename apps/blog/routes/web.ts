/**
 * Top-level route table for the blog, joining the public pages with the auth,
 * RSS, and CMS sub-trees so every URL resolves from one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/routes";

import auth from "~/routes/auth";
import cms from "~/routes/cms";
import rss from "~/routes/rss";

/**
 * Entry point the router resolves every blog URL against.
 */
export default route({
	feed: get("/"),
	colors: get("/colors"),
	sponsor: get("/sponsor"),

	wellKnown: route({
		webFinger: get("/.well-known/webfinger"),
		avatar: get("/.well-known/avatar"),
	}),

	sitemap: get("/sitemap.xml"),

	healthcheck: get("/healthcheck"),

	/**
	 * The Model Context Protocol endpoint, plus the page explaining it. `form()`
	 * answers both an agent's `POST` and a browser's `GET` to `/mcp`, so pasting
	 * the URL in a browser renders the explainer at the same address.
	 */
	mcp: form("/mcp"),

	/**
	 * The same page as Markdown, for a reader who would rather read it the way the
	 * agents it describes do. Declared on its own route, keeping `POST` matching
	 * only `/mcp` — the one path MCP clients speak to and the exemption keys on.
	 */
	mcpMarkdown: get("/mcp.md"),

	articles: get("/articles"),
	tutorials: get("/tutorials"),
	bookmarks: get("/bookmarks"),
	glossary: get("/glossary"),

	post: get("/:postType/:postSlug(.:ext)"),
	postRelated: get("/frames/posts/:postType/:postSlug/related"),

	auth,

	rss,

	cms: route("/cms", cms),
});
