/**
 * HTTP actions for Encore's privacy policy: the HTML page at `/apps/encore/privacy` and its
 * Markdown twin at `/apps/encore/privacy.md`. The policy is a bundled Markdown file, so
 * both formats render the one source and can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { parseMarkdownPage } from "~/app/services/markdown-page";
import source from "~/resources/content/encore/privacy.md?raw";
import { MarkdownPageView } from "~/resources/views/markdown-page";
import routes from "~/routes/web";

/** The error body both routes answer when the policy's own source will not parse. */
const UNREADABLE = "# Error\n\nThis page's source could not be read.\n\n";

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(status: number, body: string): Response {
	return new Response(body, { status, headers: { "Content-Type": ct.Markdown } });
}

/**
 * Serves the policy as HTML, or as Markdown when the request prefers it, so
 * `Accept: text/markdown` reaches the same body the `.md` route serves.
 *
 * @returns The policy page, or a `500` when its source will not parse.
 */
export default createAction(routes.encorePrivacy, async (ctx) => {
	let page = parseMarkdownPage(source);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(200, page.data.body);
	}

	return ctx.render(MarkdownPageView, {
		title: page.data.frontmatter.title,
		description: page.data.frontmatter.description,
		document: page.data.document,
		markdownHref: routes.encorePrivacyMarkdown.href(),
		locale: "en",
	});
});

/**
 * Serves the policy as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation.
 *
 * @returns The policy's Markdown body.
 */
export const markdownPage = createAction(routes.encorePrivacyMarkdown, async () => {
	let page = parseMarkdownPage(source);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	return markdown(200, page.data.body);
});
