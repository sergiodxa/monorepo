/**
 * Route table. Every pattern here is a published contract — linked from pages, from
 * the markdown content, and from bookmarks — so patterns are added rather than
 * reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/** Registers the site's routes. */
export default route({
	home: get("/"),

	/** The essay on why the packages look the way they do, and who funds the work. */
	philosophy: get("/philosophy"),
	/** The applications these packages are built and proven in. */
	showcase: get("/showcase"),
	/** Which releases get fixes, and how to report something privately. */
	security: get("/security"),
	/** What support a dated release carries, which is the question its number raises. */
	maintenance: get("/maintenance"),

	/** The handwritten guides, each one a markdown file in `resources/docs`. */
	docs: {
		index: get("/docs"),
		/** The changelog reads GitHub, so it is the one page whose content is fetched. */
		changelog: get("/docs/releases/changelog"),
		/** Captures every remaining segment as one slug, e.g. `conventions/naming`. */
		show: get("/docs/*slug"),
	},

	/** The reference for every published package, each read from its own README. */
	api: {
		index: get("/api"),
		/**
		 * The two catalogue packages answer on their own trees, because a README that
		 * indexes hundreds of entries is a site, not a page.
		 */
		utility: get("/api/u/:utility"),
		component: get("/api/ui/:component"),
		/** A mixin, behavior class, animation or style recipe, under the subpath it imports from. */
		uiExport: get("/api/ui/:subpath/:slug"),
		show: get("/api/:name"),
	},

	/**
	 * Where the package reference used to live. Every address under it answers with a
	 * permanent redirect to the same path under `/api`, so a bookmark or an indexed link
	 * still lands on its page.
	 */
	moved: {
		packages: get("/docs/packages"),
		package: get("/docs/packages/*path"),
	},

	/**
	 * The same pages as markdown. The source is already markdown, so serving it is a
	 * lookup rather than a conversion, and it is what an agent reads instead of parsing
	 * the rendered page back into prose.
	 */
	markdown: {
		docs: get("/docs/*slug.md"),
		package: get("/api/:name.md"),
		/**
		 * The catalogue's pages are generated rather than written, so their twins are
		 * rendered from the same records the HTML pages draw.
		 */
		utility: get("/api/u/:utility.md"),
		component: get("/api/ui/:component.md"),
		uiExport: get("/api/ui/:subpath/:slug.md"),
	},

	/** Machine-readable surfaces, each one derived from what is already in the bundle. */
	llms: get("/llms.txt"),
	sitemap: get("/sitemap.xml"),
	feed: get("/rss.xml"),
	/** The search index the palette fetches once and filters in the browser. */
	searchIndex: get("/search.json"),
	/**
	 * Package search and page reads over the Model Context Protocol. The pattern names the
	 * explainer page a person lands on; the `POST` the protocol speaks is registered on the
	 * same path beside it, since the two halves answer to different shapes of caller.
	 */
	mcp: get("/mcp"),
});
