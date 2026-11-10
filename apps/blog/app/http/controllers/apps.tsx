/**
 * HTTP controller for `/apps`: the showcase of products the author ships, and the same list
 * as Markdown at `/apps.md`. Each answers in the reader's language, English or Spanish, from
 * the same structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { AppsPage } from "~/app/services/apps-page";

import { appsFor, appsMarkdown } from "~/app/services/apps-page";
import { resolvePageLocale } from "~/app/services/page-locale";
import { AppsView } from "~/resources/views/apps";
import routes from "~/routes/web";

/** The page in the request's language, from `?lang=` or `Accept-Language`. */
function pageFor(ctx: AppContext): AppsPage {
	return appsFor(resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language")));
}

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(body: string): Response {
	return new Response(body, {
		headers: { "Content-Type": ct.Markdown, Vary: "Accept, Accept-Language" },
	});
}

/**
 * Renders the showcase, or its Markdown when the request prefers it. The response varies on
 * `Accept` and `Accept-Language`, so it stays out of the edge cache.
 *
 * @returns The `/apps` page or its Markdown.
 */
export default createAction(routes.apps, async (ctx) => {
	let page = pageFor(ctx);
	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(appsMarkdown(page));
	}
	return ctx.render(AppsView, { page });
});

/**
 * Serves the page as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation. `?lang=` picks the language as on the page.
 *
 * @returns The page's Markdown.
 */
export const markdownPage = createAction(routes.appsMarkdown, async (ctx) =>
	markdown(appsMarkdown(pageFor(ctx))),
);
