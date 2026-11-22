/**
 * Route table. Every pattern here is a published contract — linked from pages, from
 * the markdown content, and from bookmarks — so patterns are added rather than
 * reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/** Registers the site's routes. */
export default route({
	home: get("/"),

	/** The essay on why the packages look the way they do, and who funds the work. */
	philosophy: get("/philosophy"),
	/**
	 * Everything built on these packages: the applications running in production and the demos
	 * for invented products, each with a case study and, for a demo, the demo itself beneath it.
	 */
	showcase: {
		/** Every item in one grid, narrowed by `?kind=` (production, demo, landing, docs). */
		index: get("/showcase"),
		/** One item's case study: what it demonstrates, its screenshots and what it is built from. */
		show: get("/showcase/:slug"),
		/**
		 * The demo itself, whatever its kind: a landing, a docs site with its pages, search,
		 * feedback and Markdown twins, or an app with its screens.
		 */
		demo: get("/showcase/:slug/demo(/*page)"),
		/** Where a demo's forms post: an app's actions, or a docs page's feedback vote. */
		demoAction: post("/showcase/:slug/demo(/*page)"),
		/**
		 * One secondary part of a demo screen as an HTML fragment, which the screen streams in
		 * after its shell. It sits under the demo's own path, so the cookies scoped to a demo
		 * reach its frames too.
		 */
		demoFrame: get("/showcase/:slug/demo/frames/*part"),
		/** A live part of a demo app's screen as a streamed `text/plain` body, such as a CI log. */
		demoStream: get("/showcase/:slug/demo/streams/*part"),
		/** A file a demo app offers to download or subscribe to, such as a calendar's `.ics`. */
		demoFile: get("/showcase/:slug/demo/files/*part"),
		/** The demos' video clips, answered with byte ranges. */
		media: get("/showcase/media/*file"),
	},
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
		/**
		 * Where a reader the guides did not help writes to the author: the form, and the post
		 * that emails it. `?page=` names the page they came from, and `?sent=1` thanks them.
		 */
		contact: form("/docs/contact"),
		/** Captures every remaining segment as one slug, e.g. `conventions/naming`. */
		show: get("/docs/*slug"),
	},
	/**
	 * Where a docs page's "Was this helpful?" form posts. It answers with a redirect back to
	 * the page it was about, so the vote works as a plain form and a reload resends nothing.
	 */
	docsFeedback: post("/docs/feedback"),

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
		/** Every `@sdxc/icons` icon in one grid, narrowed by `?q=` against names and tags. */
		icons: get("/api/icons"),
		/** One icon: drawn large, with both ways to render it and its SVG. */
		icon: get("/api/icons/:icon"),
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
		icon: get("/api/icons/:icon.md"),
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
		/** One icon's detail, the same one its page draws, for the grid's dialog to load. */
		icon: get("/frames/icons/:icon"),
		/**
		 * Schematic PNG face for the `@sdxc/ui` explorer grid. Drawn with
		 * `@sdxc/raster` so a tile stays legible without mounting a live frame.
		 */
		face: get("/frames/faces/:component"),
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
	 * Usage stats for every package, for the maintainer. `.json` answers every snapshot the
	 * page draws from and `.md` a report of its figures, for an agent to analyse. Linked from
	 * nowhere and kept out of search engines; the address is the only way in.
	 */
	stats: get("/stats(.:format)"),
	/**
	 * Where the demos used to live. Every address answers a permanent redirect that keeps its
	 * method and query string: the galleries to the showcase's demo filter, and each demo, page,
	 * frame and clip to the same place under `/showcase/:slug/demo`.
	 */
	legacyDemos: {
		gallery: "/demo",
		apps: "/demo/apps",
		/** Every address of one demo app, its frames, streams, files and actions included. */
		app: "/demo/apps/:slug(/*rest)",
		/** Every address of one docs demo, its Markdown twins and feedback included. */
		docs: "/demo/docs/:slug(/*rest)",
		docsFrame: "/demo/frames/docs/:slug/*part",
		media: "/demo/media/*file",
		/** A landing demo under the generic name it had before it took its product's name. */
		landing: "/demo/:slug",
	},
});
