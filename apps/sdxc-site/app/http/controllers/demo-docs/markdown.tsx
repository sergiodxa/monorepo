/**
 * `GET /demo/docs/:site/*page.md` — a docs demo page's Markdown twin: its title, lead and
 * outline as plain text, which the page's "Copy page" button copies and an assistant can
 * read without the page's chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { findDemoDocsSite } from "~/resources/views/demo-docs";
import routes from "~/routes/web";

/** The params a request carries, `page` without its `.md`. */
const PARAMS = s.object({ site: s.string(), page: s.string() });

/**
 * Answers the twin as `text/markdown`, kept out of search engines like the page it mirrors;
 * an unknown site or page answers `404` in plain text.
 */
export default createAction(routes.demoDocs.markdown, async (ctx) => {
	let { page: path, site: slug } = s.parse(PARAMS, ctx.params);
	let site = await findDemoDocsSite(slug);
	let page = site && Object.hasOwn(site.pages, path) ? site.pages[path] : undefined;
	if (site === null || page === undefined) {
		return new Response("No page answers to this address.", {
			status: 404,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}

	let outline = page.toc.map(
		(item) => `${"  ".repeat(Math.max(0, item.level - 2))}- [${item.text}](#${item.id})`,
	);
	let body = [
		`# ${page.title}`,
		"",
		page.description,
		"",
		"## On this page",
		"",
		...outline,
		...(page.next
			? [
					"",
					"## Next steps",
					"",
					...page.next.map((step) => `- [${step.title}](${step.href}): ${step.description}`),
				]
			: []),
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
});
