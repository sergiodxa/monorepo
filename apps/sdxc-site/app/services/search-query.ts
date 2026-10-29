/**
 * What a search entry is, how the search syntax reads, and how a query is ranked against a
 * set of entries. The ranking is pure and holds no corpus, so the search dialog, the
 * `/search` page and the MCP search tool all answer a query in the same order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ParsedQuery, SearchFilter, SearchTerm } from "@sdxc/search/query";
import type { ValidationError } from "@sdxc/validate";

import { isFailure } from "@sdxc/result";
import { parseQuery } from "@sdxc/search/query";

/** The part of the site an entry belongs to, which is what a search tab or `kind:` narrows to. */
export type SearchKind = "guide" | "api" | "ui" | "u";

/** Every kind, in the order the search tabs list them. */
export const SEARCH_KINDS: readonly [SearchKind, ...SearchKind[]] = ["guide", "api", "u", "ui"];

/** One destination a search can land on: a page, or one heading inside it. */
export interface SearchDocument {
	/** Where the entry sends a reader, carrying the heading fragment when it has one. */
	href: string;
	/** What the entry reads as: a page's own title, or a heading's text. */
	title: string;
	/** The page the entry belongs to, which is what a heading is listed under. */
	page: string;
	/** The section or group that page sits in, so a result says where it came from. */
	section: string;
	kind: SearchKind;
	/** The page's opening sentence. A heading carries none, since the page above it does. */
	summary?: string;
}

/** The words `kind:` reads as each kind, so a reader may type the tab's name or its plural. */
const KIND_NAMES: Record<string, SearchKind> = {
	guide: "guide",
	guides: "guide",
	docs: "guide",
	api: "api",
	package: "api",
	packages: "api",
	ui: "ui",
	component: "ui",
	components: "ui",
	u: "u",
	utility: "u",
	utilities: "u",
};

/**
 * The kind a `kind:` value names, read case-blind, or `null` for a word naming none.
 *
 * @example kindNamed("Components") // "ui"
 */
export function kindNamed(value: string): SearchKind | null {
	return KIND_NAMES[value.trim().toLowerCase()] ?? null;
}

/** Score for a title the query matches whole, which is as good as a match gets. */
const TITLE_EXACT = 100;

/** Score for a title the query opens, which is what typing a name feels like. */
const TITLE_PREFIX = 60;

/** Score for a query appearing anywhere in the title. */
const TITLE_SUBSTRING = 40;

/** Score for a query that only names the page a heading belongs to. */
const PAGE_SUBSTRING = 20;

/** Score for a query found in the page's summary, which is prose rather than a label. */
const SUMMARY_SUBSTRING = 10;

/** Score for a query that only names the section, the weakest signal worth keeping. */
const SECTION_SUBSTRING = 5;

/** The words a query is matched by, lowercased so every comparison is case-blind. */
export function tokenize(query: string): string[] {
	return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether a character continues a word, which is what decides where the next one starts. */
function isWordCharacter(character: string | undefined): boolean {
	if (character === undefined) return false;
	return /[a-z0-9]/.test(character);
}

/**
 * Whether `token` starts a word somewhere in `text`, both already lowercased. A plain
 * substring test would answer "dated" with "Validated", which is how a search for the
 * versioning scheme comes back headed by an unrelated form example.
 *
 * @param text - What to look in.
 * @param token - One word of the query.
 * @returns Whether a word in `text` begins with `token`.
 * @example includesWord("read and write opml subscription lists", "opml")
 */
export function includesWord(text: string, token: string): boolean {
	for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1)) {
		if (!isWordCharacter(text[at - 1])) return true;
	}

	return false;
}

/**
 * A package title without its npm scope. Somebody after `@sdxc/result` types "result",
 * and every package here carries the same scope, so matching on the scoped name alone
 * would rank each of the sixty behind any guide whose title opens on the same word.
 */
function unscoped(title: string): string {
	return title.startsWith("@") ? (title.split("/").at(-1) ?? title) : title;
}

/**
 * How well one entry answers one word of a query, reading the strongest field the word
 * appears in. Zero means the word is absent, which is what disqualifies the entry.
 */
function scoreToken(document: SearchDocument, token: string): number {
	let title = document.title.toLowerCase();
	let name = unscoped(title);

	if (title === token || name === token) return TITLE_EXACT;
	if (title.startsWith(token) || name.startsWith(token)) return TITLE_PREFIX;
	if (includesWord(title, token)) return TITLE_SUBSTRING;
	if (includesWord(document.page.toLowerCase(), token)) return PAGE_SUBSTRING;
	if (document.summary && includesWord(document.summary.toLowerCase(), token)) {
		return SUMMARY_SUBSTRING;
	}
	if (includesWord(document.section.toLowerCase(), token)) return SECTION_SUBSTRING;

	return 0;
}

/**
 * Reads what a reader typed with the search syntax: words that must all match, `"phrases"`,
 * `-word` to leave one out, `a OR b`, and `kind:` (or `-kind:`) to narrow by part of the site.
 *
 * @param text - What the reader typed.
 * @returns The query, `null` for a blank box, or why the text cannot run.
 * @example parseSearch("router kind:guides -legacy")
 */
export function parseSearch(text: string): Result<ParsedQuery | null, ValidationError> {
	return parseQuery(text, { filters: ["kind"] });
}

/**
 * How well an entry answers one clause: its best alternative, since an `OR` is satisfied by
 * any one of them. Zero means none of them reached it.
 */
function scoreClause(document: SearchDocument, terms: SearchTerm[]): number {
	return Math.max(...terms.map((term) => scoreToken(document, term.text.toLowerCase())));
}

/** Whether an entry's kind passes one `kind:` filter: named by it, or not named by an exclusion. */
function passesKindFilter(document: SearchDocument, filter: SearchFilter): boolean {
	let named = filter.values.some((value) => kindNamed(value) === document.kind);
	return named !== filter.exclude;
}

/**
 * Every entry a parsed query reaches, strongest first: each positive clause must reach it,
 * no excluded clause may, and every `kind:` filter must hold. A query of filters alone keeps
 * the corpus order, which lists a page above the headings inside it.
 *
 * @param documents - The corpus, in the order it should tie-break in.
 * @param query - The parsed query.
 * @returns Every match, best first.
 */
export function matchDocuments(
	documents: readonly SearchDocument[],
	query: ParsedQuery,
): SearchDocument[] {
	let required = query.clauses.filter((clause) => !clause.exclude);
	let excluded = query.clauses.filter((clause) => clause.exclude);
	let scored: Array<{ document: SearchDocument; score: number; order: number }> = [];

	for (let [order, document] of documents.entries()) {
		if (!query.filters.every((filter) => passesKindFilter(document, filter))) continue;
		if (excluded.some((clause) => scoreClause(document, clause.terms) > 0)) continue;

		let total = 0;
		for (let clause of required) {
			let score = scoreClause(document, clause.terms);
			if (score === 0) {
				total = -1;
				break;
			}
			total += score;
		}

		if (total >= 0) scored.push({ document, score: total, order });
	}

	scored.sort((a, b) => b.score - a.score || a.order - b.order);

	return scored.map((entry) => entry.document);
}

/**
 * Ranks a corpus against a query as typed, keeping only the entries every word reaches.
 * Requiring all of them is what makes a second word narrow the list, which is how a reader
 * expects a search to behave when the first word matched too much.
 *
 * @param documents - The corpus to rank, in the order it should tie-break in.
 * @param query - What the reader typed; an empty one keeps the corpus order, and text the syntax cannot run reaches nothing.
 * @param limit - How many entries to return.
 * @returns The best matches, strongest first, at most `limit` of them.
 * @example rankDocuments(index, "parse markdown kind:api", 10)
 */
export function rankDocuments(
	documents: readonly SearchDocument[],
	query: string,
	limit: number,
): SearchDocument[] {
	let parsed = parseSearch(query);
	if (isFailure(parsed)) return [];
	if (parsed.data === null) return documents.slice(0, limit);
	return matchDocuments(documents, parsed.data).slice(0, limit);
}
