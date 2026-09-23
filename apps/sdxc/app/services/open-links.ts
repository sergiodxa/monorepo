/**
 * Where a page can be opened other than here: its own markdown, its source on GitHub, and
 * the assistants a reader pastes documentation into. Each assistant link carries the
 * page's markdown URL rather than its HTML, so what the assistant fetches is the text this
 * site was rendered from rather than a page it has to strip chrome out of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One destination the page's `Open` menu offers. */
export interface OpenLink {
	label: string;
	href: string;
	/** Whether the destination is somewhere else, which is what earns a new tab. */
	external: boolean;
}

/** Where a new conversation is started with a prompt already written into it. */
const ASSISTANTS = [
	{ label: "Open in ChatGPT", base: "https://chatgpt.com/", parameter: "q" },
	{ label: "Open in Claude", base: "https://claude.ai/new", parameter: "q" },
] as const;

/** What the assistant is asked to do, which is read the page before anything else. */
function prompt(markdownUrl: string): string {
	return `Read ${markdownUrl} so you can answer questions about it. Say when you have.`;
}

/**
 * The destinations one page's `Open` menu lists, in the order it lists them.
 *
 * Reading the markdown here follows the path, so it stays on whichever host served the
 * page; handing it to an assistant takes the absolute URL, since the fetch happens
 * somewhere else entirely.
 *
 * @param markdownHref - The page's markdown twin, as a path on this site.
 * @param markdownUrl - The same twin, absolute, for a reader that is not this browser.
 * @param sourceUrl - Where the page's source is read on GitHub.
 * @returns The menu's entries.
 * @example buildOpenLinks("/docs/packages/result.md", markdownUrl, sourceUrl)
 */
export function buildOpenLinks(
	markdownHref: string,
	markdownUrl: string,
	sourceUrl: string,
): OpenLink[] {
	let links: OpenLink[] = [
		{ label: "View as Markdown", href: markdownHref, external: false },
		{ label: "Open in GitHub", href: sourceUrl, external: true },
	];

	for (let assistant of ASSISTANTS) {
		let url = new URL(assistant.base);
		url.searchParams.set(assistant.parameter, prompt(markdownUrl));
		links.push({ label: assistant.label, href: url.href, external: true });
	}

	return links;
}
