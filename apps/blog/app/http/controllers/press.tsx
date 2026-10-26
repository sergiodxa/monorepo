/**
 * HTTP actions for the press kit: the HTML page at `/press` and its Markdown twin at
 * `/press.md`. The kit is a bundled Markdown file, so the page an organizer reads and the
 * text they paste into a speaker form always say the same thing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { parseMarkdownPage } from "~/app/services/markdown-page";
import source from "~/resources/content/press.md?raw";
import { MarkdownPageView } from "~/resources/views/markdown-page";
import routes from "~/routes/web";

/** The error body both routes answer when the kit's own source will not parse. */
const UNREADABLE = "# Error\n\nThis page's source could not be read.\n\n";

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(status: number, body: string): Response {
	return new Response(body, { status, headers: { "Content-Type": ct.Markdown } });
}

/**
 * Serves the kit as HTML, or as Markdown when the request prefers it, so
 * `Accept: text/markdown` reaches the same body the `.md` route serves.
 *
 * @returns The press kit page, or a `500` when its source will not parse.
 */
export default createAction(routes.press, async (ctx) => {
	let page = parseMarkdownPage(source);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(200, page.data.body);
	}

	return ctx.render(MarkdownPageView, {
		title: page.data.frontmatter.title,
		description: page.data.frontmatter.description,
		activePath: routes.press.href(),
		document: page.data.document,
		markdownHref: routes.pressMarkdown.href(),
		locale: "en",
	});
});

/**
 * Serves the kit as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation.
 *
 * @returns The kit's Markdown body.
 */
export const markdownPage = createAction(routes.pressMarkdown, async () => {
	let page = parseMarkdownPage(source);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	return markdown(200, page.data.body);
});
