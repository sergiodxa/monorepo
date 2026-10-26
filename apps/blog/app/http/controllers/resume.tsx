/**
 * HTTP controller for `/resume`: the designed résumé and the same résumé as Markdown at
 * `/resume.md`. Each answers in the reader's language, English or Spanish, from the same
 * structured document the PDFs are typeset from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { Resume } from "~/app/services/resume";

import { resolvePageLocale } from "~/app/services/page-locale";
import { resumeFor, resumeMarkdown } from "~/app/services/resume";
import { ResumeView } from "~/resources/views/resume";
import routes from "~/routes/web";

/** The résumé in the request's language, from `?lang=` or `Accept-Language`. */
function resumeIn(ctx: AppContext): Resume {
	return resumeFor(resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language")));
}

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(body: string): Response {
	return new Response(body, {
		headers: { "Content-Type": ct.Markdown, Vary: "Accept, Accept-Language" },
	});
}

/**
 * Renders the résumé, or its Markdown when the request prefers it. The response varies on
 * `Accept` and `Accept-Language`, so it stays out of the edge cache.
 *
 * @returns The `/resume` page or its Markdown.
 */
export default createAction(routes.resume, async (ctx) => {
	let resume = resumeIn(ctx);
	if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
		return markdown(resumeMarkdown(resume, ctx.url.origin));
	}
	return ctx.render(ResumeView, { resume });
});

/**
 * Serves the résumé as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation. `?lang=` picks the language as on the page.
 *
 * @returns The résumé's Markdown.
 */
export const markdownPage = createAction(routes.resumeMarkdown, async (ctx) =>
	markdown(resumeMarkdown(resumeIn(ctx), ctx.url.origin)),
);
