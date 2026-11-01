/**
 * Search over one docs demo: matches a query against every page's title, lead and section
 * headings, so a reader finds a page by a word in any of them, and ranks a title match
 * above a match further down the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Highlight } from "@sdxc/ui";

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";

/** One page a query found, with the line that matched split for highlighting. */
export interface DemoDocsResult {
	title: string;
	href: string;
	/** The section heading that matched, which the result links to directly. */
	heading?: string;
	/** The page's lead, or the heading that matched, split into matching and other runs. */
	excerpt: Highlight.Segment[];
	titleSegments: Highlight.Segment[];
}

/** The fewest characters a query needs before it searches, so one letter lists nothing. */
const MIN_QUERY_LENGTH = 2;

/**
 * Finds the pages of a site holding every word of the query, in title, lead or a heading.
 *
 * @param site The docs demo to search.
 * @param slug The demo's folder name, which its addresses start with.
 * @param query What the reader typed; blank or one letter finds nothing.
 * @returns The matching pages, title matches first, then in tree order.
 */
export function searchDemoDocs(site: DemoDocsSite, slug: string, query: string): DemoDocsResult[] {
	let words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (query.trim().length < MIN_QUERY_LENGTH || words.length === 0) return [];
	let href = demoDocsHref(slug);

	let results = Object.entries(site.pages).flatMap(([path, page]) => {
		let haystack = [page.title, page.description, ...page.toc.map((item) => item.text)]
			.join(" ")
			.toLowerCase();
		if (!words.every((word) => haystack.includes(word))) return [];

		let inTitle = words.some((word) => page.title.toLowerCase().includes(word));
		let heading = page.toc.find((item) =>
			words.some((word) => item.text.toLowerCase().includes(word)),
		);
		let leadMatches = words.some((word) => page.description.toLowerCase().includes(word));
		let section = !inTitle && !leadMatches ? heading : undefined;

		return [
			{
				rank: inTitle ? 0 : 1,
				result: {
					title: page.title,
					href: section ? `${href(path)}#${section.id}` : href(path),
					heading: section?.text,
					excerpt: highlight(section?.text ?? page.description, words),
					titleSegments: highlight(page.title, words),
				},
			},
		];
	});

	return results.sort((a, b) => a.rank - b.rank).map((entry) => entry.result);
}

/**
 * Splits text into runs that match one of the words and runs that don't, matching without
 * regard to case so "Domain" highlights for "domain".
 */
function highlight(text: string, words: string[]): Highlight.Segment[] {
	let pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
	return text
		.split(pattern)
		.filter((part) => part !== "")
		.map((part) => ({ text: part, match: words.includes(part.toLowerCase()) }));
}

/** Escapes a word so it matches literally inside a pattern. */
function escapeRegExp(word: string): string {
	return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
