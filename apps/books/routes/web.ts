/**
 * Route table for the books site: the homepage's email capture, each book's landing, free
 * chapter and upgrade pages under the book's own slug, the sample's EPUB download, the
 * checkout redirect, the Polar webhook, and the redirects from the single-book URLs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/**
 * Registers the site's pages, form endpoints, checkout redirect, and webhook. Static paths
 * outrank the `/:book` patterns, so `/health` or `/sample/download` never reach a book page.
 */
export default route({
	home: get("/"),
	health: get("/health"),

	/** A book's landing, for any slug the catalogue in `config/books.ts` lists. */
	book: get("/:book"),

	/** GET renders the email form; POST unlocks and renders the book's sample chapter. */
	sample: form("/:book/sample"),

	/**
	 * The sample chapter as an EPUB. Reached only through the signed, hour-long link the
	 * unlocked sample page mints; any other request is sent back to the form.
	 */
	sampleDownload: get("/sample/download"),

	/** GET renders the email form; POST resolves the customer and redirects to checkout. */
	upgrade: form("/:book/upgrade"),

	/**
	 * The URLs the site published while it sold one book, in newsletters and social posts
	 * still in the wild. Each answers any method with a permanent redirect to the same page
	 * under the book's slug, a 308 so a form posted from a cached page still posts.
	 */
	legacy: route({
		release: "/release",
		sample: "/sample",
		upgrade: "/upgrade",
	}),

	api: route({
		subscribe: post("/api/subscribe"),

		/**
		 * This URL is linked from the pricing page and from the upgrade flow's
		 * redirects, and it is shareable, so it stays a GET that 302s to Polar.
		 */
		checkout: get("/api/checkout/:type"),
	}),

	webhooks: route({
		polar: post("/webhooks/polar"),
	}),
	/** Where browsers send the Content Security Policy violation reports the policy names. */
	cspReports: post("/reports/csp"),
});
