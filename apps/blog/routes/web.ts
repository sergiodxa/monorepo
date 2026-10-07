/**
 * Top-level route table for the blog, joining the public pages with the auth,
 * feed, and CMS sub-trees so every URL resolves from one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

import atom from "~/routes/atom";
import auth from "~/routes/auth";
import cms from "~/routes/cms";
import jsonFeed from "~/routes/json-feed";
import rss from "~/routes/rss";

/**
 * Entry point the router resolves every blog URL against.
 */
export default route({
	feed: get("/"),
	colors: get("/colors"),
	/** The short sponsor URL shared in the wild, which redirects to `sponsors`. */
	sponsor: get("/sponsor"),
	/** The case for sponsoring, and who sponsors the author now and did before. */
	sponsors: get("/sponsors"),

	wellKnown: route({
		webFinger: get("/.well-known/webfinger"),
		avatar: get("/.well-known/avatar"),
	}),

	sitemap: get("/sitemap.xml"),

	healthcheck: get("/healthcheck"),

	/**
	 * The Webmention endpoint every page advertises, taking form-encoded `source` and
	 * `target` from other sites that link to a post here.
	 */
	webmention: post("/webmention"),

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

	/**
	 * The support page the Encore App Store listings link to. `form()` serves the page on
	 * `GET` and takes the support request on `POST` at the same address, so a failed
	 * submission re-renders where the visitor already is.
	 */
	encoreSupport: form("/apps/encore/support"),

	/**
	 * Encore's privacy policy, which the App Store listings and the support form link to,
	 * plus the same policy as Markdown on its own route.
	 */
	encorePrivacy: get("/apps/encore/privacy"),
	encorePrivacyMarkdown: get("/apps/encore/privacy.md"),

	articles: get("/articles"),
	tutorials: get("/tutorials"),
	bookmarks: get("/bookmarks"),
	glossary: get("/glossary"),

	/**
	 * Full-text search over published articles, tutorials and glossary entries. A plain
	 * `GET` form submits `?q=`, so a results page is a URL a reader can share or bookmark.
	 */
	search: get("/search"),

	/**
	 * The search dialog's body, loaded into the `<Frame>` every public page carries: the
	 * search box and the top matches for `?q=`, re-requested as the visitor types.
	 */
	searchFrame: get("/frames/search"),

	post: get("/:postType/:postSlug(.:ext)"),
	postRelated: get("/frames/posts/:postType/:postSlug/related"),

	auth,

	rss,
	atom,
	jsonFeed,

	cms: route("/cms", cms),
});
