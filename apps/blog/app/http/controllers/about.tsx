/**
 * HTTP controller for the about page: the designed page at `/about` and the same page as
 * Markdown at `/about.md`. Each answers in the reader's language, English or Spanish, from
 * the same structured content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { AboutPage } from "~/app/services/about-page";

import { aboutPageFor, aboutPageMarkdown } from "~/app/services/about-page";
import { resolvePageLocale } from "~/app/services/page-locale";
import { AboutView } from "~/resources/views/about";
import routes from "~/routes/web";

/** The page in the request's language, from `?lang=` or `Accept-Language`. */
function pageFor(ctx: AppContext): AboutPage {
	return aboutPageFor(resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language")));
}

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(body: string): Response {
	return new Response(body, {
		headers: { "Content-Type": ct.Markdown, Vary: "Accept, Accept-Language" },
	});
}

/**
 * Renders the about page, as Markdown when the request prefers it. The language follows the
 * request, so the response varies on `Accept` and `Accept-Language`.
 *
 * @returns The about page or its Markdown.
 */
export default createAction(routes.about, async (ctx) => {
	let page = pageFor(ctx);
	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(aboutPageMarkdown(page, ctx.url.origin));
	}
	return ctx.render(
		AboutView,
		{ page },
		{ headers: { "Content-Language": page.locale, Vary: "Accept, Accept-Language" } },
	);
});

/**
 * Serves the page as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation. `?lang=` picks the language as on the page.
 *
 * @returns The page's Markdown.
 */
export const markdownPage = createAction(routes.aboutMarkdown, async (ctx) =>
	markdown(aboutPageMarkdown(pageFor(ctx), ctx.url.origin)),
);
