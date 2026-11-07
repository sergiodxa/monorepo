/**
 * HTTP actions for Encore's privacy policy: the HTML page at `/apps/encore/privacy` and its
 * Markdown twin at `/apps/encore/privacy.md`. The policy is a bundled Markdown file per
 * language, so both formats render the one source and can never disagree. English, Argentine
 * Spanish and Japanese follow `?lang=` or `Accept-Language`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { EncoreLocale } from "~/config/encore";

import { parseMarkdownPage } from "~/app/services/markdown-page";
import { resolveLocale } from "~/app/services/page-locale";
import { ENCORE_LOCALES } from "~/config/encore";
import spanish from "~/resources/content/encore/privacy.es-AR.md?raw";
import japanese from "~/resources/content/encore/privacy.ja.md?raw";
import english from "~/resources/content/encore/privacy.md?raw";
import { EncorePrivacyView } from "~/resources/views/encore/privacy";
import routes from "~/routes/web";

/** The error body both routes answer when the policy's own source will not parse. */
const UNREADABLE = "# Error\n\nThis page's source could not be read.\n\n";

/** The policy's Markdown source in each language it is written in. */
const SOURCES: Record<EncoreLocale, string> = { en: english, "es-AR": spanish, ja: japanese };

/** The request's language, from `?lang=` or `Accept-Language`. */
function localeOf(ctx: AppContext): EncoreLocale {
	return resolveLocale(ctx.url, ctx.request.headers.get("Accept-Language"), ENCORE_LOCALES);
}

/**
 * Builds a Markdown response with the site's Markdown content type, in `locale`, varying on
 * the headers the format and the language were picked from.
 */
function markdown(status: number, body: string, locale: EncoreLocale = "en"): Response {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": ct.Markdown,
			"Content-Language": locale,
			Vary: "Accept, Accept-Language",
		},
	});
}

/**
 * Serves the policy as HTML, or as Markdown when the request prefers it, so
 * `Accept: text/markdown` reaches the same body the `.md` route serves.
 *
 * @returns The policy page, or a `500` when its source will not parse.
 */
export default createAction(routes.encorePrivacy, async (ctx) => {
	let locale = localeOf(ctx);
	let page = parseMarkdownPage(SOURCES[locale]);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(200, page.data.body, locale);
	}

	return ctx.render(
		EncorePrivacyView,
		{
			title: page.data.frontmatter.title,
			description: page.data.frontmatter.description,
			document: page.data.document,
			locale,
		},
		{ headers: { "Content-Language": locale, Vary: "Accept, Accept-Language" } },
	);
});

/**
 * Serves the policy as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation.
 *
 * @returns The policy's Markdown body.
 */
export const markdownPage = createAction(routes.encorePrivacyMarkdown, async (ctx) => {
	let locale = localeOf(ctx);
	let page = parseMarkdownPage(SOURCES[locale]);
	if (isFailure(page)) return markdown(500, UNREADABLE);

	return markdown(200, page.data.body, locale);
});
