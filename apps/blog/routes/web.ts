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
	 * The Model Context Protocol endpoint, plus the page explaining it.
	 *
	 * `form()` rather than two routes: every MCP message is a `POST` to one path, and a
	 * person who pastes that same URL into a browser arrives with a `GET`. Sharing the path
	 * means the address somebody was given is the address that explains itself, rather than
	 * a `404` for anyone who clicks instead of configuring.
	 */
	mcp: form("/mcp"),

	/**
	 * The same page as Markdown, for a reader who would rather read it the way the agents it
	 * describes do. Its own route rather than an optional `(.:ext)` on {@link mcp}, so a
	 * `POST` still matches only `/mcp` — the one path MCP clients speak to, and the one the
	 * machine-surface middleware exemption is keyed on.
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
