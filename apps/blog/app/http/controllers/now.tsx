/**
 * HTTP actions for the now page: the designed page at `/now` and its Markdown twin at
 * `/now.md`. Each answers in the reader's language, English or Spanish, from the same
 * structured page, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { NowPage } from "~/app/services/now-page";

import { nowPageFor, nowPageMarkdown } from "~/app/services/now-page";
import { resolvePageLocale } from "~/app/services/page-locale";
import { NowView } from "~/resources/views/now";
import routes from "~/routes/web";

/** The page in the request's language, from `?lang=` or `Accept-Language`. */
function pageFor(ctx: AppContext): NowPage {
	return nowPageFor(resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language")));
}

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(body: string): Response {
	return new Response(body, {
		headers: { "Content-Type": ct.Markdown, Vary: "Accept, Accept-Language" },
	});
}

/**
 * Serves the page as HTML, or as Markdown when the request prefers it, so
 * `Accept: text/markdown` reaches the same body the `.md` route serves.
 *
 * @returns The now page or its Markdown.
 */
export default createAction(routes.now, async (ctx) => {
	let page = pageFor(ctx);
	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(nowPageMarkdown(page, ctx.url.origin));
	}

	return ctx.render(NowView, { page });
});

/**
 * Serves the page as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation. `?lang=` picks the language as on the page.
 *
 * @returns The page's Markdown.
 */
export const markdownPage = createAction(routes.nowMarkdown, async (ctx) =>
	markdown(nowPageMarkdown(pageFor(ctx), ctx.url.origin)),
);
