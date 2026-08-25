/**
 * Top-level route table for the blog, joining the public pages with the auth,
 * RSS, and CMS sub-trees so every URL resolves from one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

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
	 * The Model Context Protocol endpoint, for agents rather than readers.
	 *
	 * `post()` because every MCP message is a `POST` to one path — the revision this server
	 * speaks has no stream to open with a `GET` and no session to end with a `DELETE`, and
	 * the package answers both with `405`.
	 */
	mcp: post("/mcp"),

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
