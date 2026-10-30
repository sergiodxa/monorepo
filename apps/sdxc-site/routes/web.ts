/**
 * Route table. Every pattern here is a published contract — linked from pages, from
 * the markdown content, and from bookmarks — so patterns are added rather than
 * reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

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
	/** The case for funding the work, and who funds it now and did before. */
	sponsors: get("/sponsors"),
	/** Where GitHub reports a sponsorship change, so the roster refreshes without waiting. */
	sponsorsWebhook: post("/webhooks/sponsors"),

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

	/**
	 * Fragments a page loads through a `<Frame>`, which is how a guide's markdown holds a
	 * live region: the prose stays static and the region is this route's response.
	 */
	frames: {
		/** One component's live preview, the same one its reference page opens with. */
		preview: get("/frames/previews/:component"),
		/** One of the live examples its reference page lists under the preview. */
		example: get("/frames/previews/:component/:example"),
		/** One live example of a `@sdxc/u` utility, as its reference page lists it. */
		utility: get("/frames/u/:utility/:example"),
		/** One live demo a guide frames beside the snippet that produces it. */
		guide: get("/frames/guides/:guide/:demo"),
	},

	/**
	 * Where a live example's links and forms lead. An example reads like an app, so it names
	 * app paths; under this prefix every one of them returns the reader to the page they
	 * pressed it on.
	 */
	examples: {
		visit: get("/examples/*path"),
		submit: post("/examples/*path"),
	},

	/** Machine-readable surfaces, each one derived from what is already in the bundle. */
	llms: get("/llms.txt"),
	sitemap: get("/sitemap.xml"),
	feed: get("/rss.xml"),
	/** Every page and heading a search can land on, for a consumer ranking them itself. */
	searchIndex: get("/search.json"),
	/**
	 * Every guide and package matching `?q=`, a page at a time. A plain `GET` form submits
	 * here, so search works without script and a result list has its own address.
	 */
	search: get("/search"),
	/**
	 * The search dialog's body, loaded into the `<Frame>` every page's header carries: the
	 * box, a tab per kind, and the top matches for `?q=`, re-requested as the reader types.
	 */
	searchFrame: get("/frames/search"),
	/**
	 * Package search and page reads over the Model Context Protocol. The pattern names the
	 * explainer page a person lands on; the `POST` the protocol speaks is registered on the
	 * same path beside it, since the two halves answer to different shapes of caller.
	 */
	mcp: get("/mcp"),
	/** Where browsers send the Content Security Policy violation reports the policy names. */
	cspReports: post("/reports/csp"),
	/** Whether every store and service the site reads answers, for an uptime monitor to poll. */
	health: get("/health"),
	/** JSON Schema documents, each served at the URL its `$id` names. */
	schemas: {
		/** The `application/health+json` report format `/health` answers in. */
		health: get("/schemas/health.json"),
	},
	/** The crawl rules and AI usage preferences, served as robots.txt. */
	robots: get("/robots.txt"),
	/**
	 * A complete sample landing built from `@sdxc/ui`'s marketing parts, kept out of search
	 * engines: each one invents its product, so none of it is a page about sdxc.
	 */
	demo: get("/demo/:slug"),
});
