/**
 * How a docs sidebar's title filter matches pages, shared by the server, which draws a
 * filtered tree for a reader without script, and the browser, which filters as they type,
 * so both keep exactly the same pages for the same query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsTree } from "./docs-tree.js";

/** What a query keeps of a tree: the items left shown and the groups opened around a match. */
export interface DocsTreeMatches {
	shown: Set<DocsTree.Item>;
	opened: Set<DocsTree.Item>;
}

/** Lower-cases `value` and strips diacritics, so "Configuracion" finds "Configuración". */
export function normalizeFilterText(value: string): string {
	return value
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** The normalized words of `query`; an empty list keeps every page. */
export function filterWords(query: string): string[] {
	return normalizeFilterText(query).split(/\s+/).filter(Boolean);
}

/** Whether `title` holds every word, case- and accent-insensitive. */
export function titleMatches(title: string, words: string[]): boolean {
	let normalized = normalizeFilterText(title);
	return words.every((word) => normalized.includes(word));
}

/**
 * The items of `tree` whose title holds every word of `query`, with the groups that contain
 * them; a group whose own title matches keeps all its pages. Returns `null` for a query with
 * no words, which keeps the whole tree as drawn.
 */
export function matchDocsTree(tree: DocsTree, query: string): DocsTreeMatches | null {
	let words = filterWords(query);
	if (words.length === 0) return null;
	let matches: DocsTreeMatches = { shown: new Set(), opened: new Set() };
	for (let section of tree.sections) {
		for (let item of section.items) collect(item, words, matches);
	}
	return matches;
}

/** Adds `item` and its matching pages to `matches`; reports whether it stays shown. */
function collect(item: DocsTree.Item, words: string[], matches: DocsTreeMatches): boolean {
	let own = titleMatches(item.title, words);
	let childShown = false;
	for (let child of item.items ?? []) {
		childShown = collect(child, own ? [] : words, matches) || childShown;
	}
	if (childShown && words.length > 0) matches.opened.add(item);
	if (own || childShown) matches.shown.add(item);
	return own || childShown;
}
