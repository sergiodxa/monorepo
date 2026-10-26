/**
 * Loads the `/mcp` page's content from the bundled Markdown files, one per language. The
 * page is prose content, so it lives as Markdown the way a post does — which also means it
 * can be served *as* Markdown to the agents the page is about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { MarkdownPage } from "~/app/services/markdown-page";
import type { PageLocale } from "~/app/services/page-locale";

import { parseMarkdownPage } from "~/app/services/markdown-page";

/**
 * The bundled sources, keyed by path.
 *
 * Each entry is a loader, so the Markdown stays a string the bundler resolves and parsing
 * runs only when a request asks for it, past the module's own evaluation.
 */
const sources = import.meta.glob<string>("../../resources/content/mcp/*.md", {
	query: "?raw",
	import: "default",
});

/** The page as one language states it. */
export interface McpPage extends MarkdownPage {
	locale: PageLocale;
}

/**
 * Loads and parses the page in one language.
 *
 * A locale missing its source file surfaces as a 500 error naming the locale, keeping a
 * mismatch between the locale list and the bundled files diagnosable.
 *
 * @param locale The language to load.
 * @returns The parsed page, or the error when its source will not read.
 * @example
 * let page = await loadMcpPage("es");
 */
export async function loadMcpPage(locale: PageLocale): Promise<Result<McpPage, Error>> {
	let load = sources[`../../resources/content/mcp/${locale}.md`];
	if (!load) return failure(new Error(`No MCP page source for locale "${locale}"`));

	let parsed = parseMarkdownPage(await load());
	if (isFailure(parsed)) return parsed;

	return success({ locale, ...parsed.data });
}
