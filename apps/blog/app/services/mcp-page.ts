/**
 * Loads the `/mcp` page's content from the bundled Markdown files, one per language.
 *
 * The page is prose rather than data, so it lives as Markdown the way a post does — which
 * also means it can be served *as* Markdown to the agents the page is about. The files are
 * bundled through `import.meta.glob`, so no request reads a filesystem, and parsing happens
 * per request rather than at module scope, where a parse failure would take the whole
 * Worker down at deploy time instead of failing one route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown as MarkdownType } from "@pkg/markdown/server";
import type { Result } from "@pkg/result";

import { Markdown } from "@pkg/markdown/server";
import { failure, isFailure, success } from "@pkg/result";
import * as s from "remix/data-schema";

/**
 * Languages the page is written in.
 *
 * English leads because it is the fallback: a reader whose language is neither gets it.
 */
export const MCP_PAGE_LOCALES = ["en", "es-AR"] as const;

/** One of the languages the page is written in. */
export type McpPageLocale = (typeof MCP_PAGE_LOCALES)[number];

/** The page's own metadata, carried in each file's frontmatter. */
const frontmatterSchema = s.object({ title: s.string(), description: s.string() });

/** Metadata every language's file declares. */
export type McpPageFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/** Parser shared by both files. */
const markdown = new Markdown({ frontmatter: frontmatterSchema });

/**
 * The bundled sources, keyed by path.
 *
 * Loaders rather than eager imports so the Markdown is a string the bundler resolves, not
 * work done when the module is first evaluated.
 */
const sources = import.meta.glob<string>("../../resources/content/mcp/*.md", {
	query: "?raw",
	import: "default",
});

/** The page as one language states it. */
export interface McpPage {
	locale: McpPageLocale;
	frontmatter: McpPageFrontmatter;
	/** The body as written, without frontmatter, for serving as Markdown. */
	body: string;
	/** The body as a render tree, for the HTML view. */
	content: MarkdownType.Parsed<McpPageFrontmatter>["content"];
}

/** Reports whether a string is exactly one of the languages the page is written in. */
export function isMcpPageLocale(value: string): value is McpPageLocale {
	return (MCP_PAGE_LOCALES as readonly string[]).includes(value);
}

/**
 * Finds the language a request tag should be served in.
 *
 * An exact match wins, then a match on the base tag, so `es`, `es-MX` and `es-419` all reach
 * the Argentine Spanish page. There is one Spanish translation and there should be one: the
 * regional tag says which Spanish it is written in, not which readers it is for.
 *
 * @param tag A language tag, from a header or a query parameter.
 * @returns The language to serve, or `undefined` when the page is in none like it.
 */
function matchLocale(tag: string): McpPageLocale | undefined {
	let wanted = tag.trim().toLowerCase();
	if (wanted === "") return undefined;

	let exact = MCP_PAGE_LOCALES.find((locale) => locale.toLowerCase() === wanted);
	if (exact) return exact;

	let base = wanted.split("-")[0];
	return MCP_PAGE_LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === base);
}

/**
 * Picks the language to serve.
 *
 * An explicit `?lang=` wins, because a reader who asked for a language by hand has said
 * something their browser's settings cannot override — and because it is the only way to
 * link somebody to a translation, or to share one.
 *
 * Otherwise the first `Accept-Language` entry that matches, exactly or on its base tag, so
 * `es`, `es-MX` and `es-419` all reach the Argentine Spanish page. Quality values are
 * honoured only by order, which is what browsers send anyway.
 *
 * @param url The request URL, read for `?lang=`.
 * @param acceptLanguage The request's `Accept-Language` header, when it sent one.
 * @returns The language to serve, defaulting to English.
 */
export function resolveMcpPageLocale(url: URL, acceptLanguage: string | null): McpPageLocale {
	let requested = url.searchParams.get("lang");
	if (requested !== null) {
		let chosen = matchLocale(requested);
		if (chosen) return chosen;
	}

	for (let entry of acceptLanguage?.split(",") ?? []) {
		let chosen = matchLocale(entry.split(";")[0] ?? "");
		if (chosen) return chosen;
	}

	return "en";
}

/**
 * Loads and parses the page in one language.
 *
 * @param locale The language to load.
 * @returns The parsed page, or the parse error when the file's frontmatter is wrong.
 * @example
 * let page = await loadMcpPage("es");
 */
export async function loadMcpPage(locale: McpPageLocale): Promise<Result<McpPage, Error>> {
	let load = sources[`../../resources/content/mcp/${locale}.md`];
	// Unreachable while the glob and the locale list agree; a guard rather than a `!` so
	// adding a locale to the list without adding its file fails as a 500 with a message
	// naming the missing file, not as `undefined is not a function`.
	if (!load) return failure(new Error(`No MCP page source for locale "${locale}"`));

	let raw = await load();

	let parsed = markdown.parse(raw);
	if (isFailure(parsed)) return parsed;

	let split = Markdown.frontmatter(raw, frontmatterSchema);
	if (isFailure(split)) return split;

	return success({
		locale,
		frontmatter: parsed.data.frontmatter,
		body: split.data.content,
		content: parsed.data.content,
	});
}
