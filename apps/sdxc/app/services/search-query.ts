/**
 * What a search entry is, and how a query is ranked against a set of them. The
 * ranking is pure and holds no corpus, so the palette in the browser, the `/search.json`
 * consumer and the MCP search tool all order results the same way rather than each
 * inventing its own notion of a good match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
	/** The page's opening sentence. A heading carries none, since the page above it does. */
	summary?: string;
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
 * Whether `token` starts a word somewhere in `text`, both already lowercased.
 *
 * A plain substring test would answer "dated" with "Validated", which is how a search for
 * the versioning scheme comes back headed by an unrelated form example. Requiring a word
 * to start where the query does is what keeps a short word from matching by accident.
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
 * Ranks a corpus against a query, keeping only the entries every word of the query
 * reaches. Requiring all of them is what makes a second word narrow the list, which is
 * how a reader expects a palette to behave when the first word matched too much.
 *
 * @param documents - The corpus to rank, in the order it should tie-break in.
 * @param query - What the reader typed; an empty one keeps the corpus order.
 * @param limit - How many entries to return.
 * @returns The best matches, strongest first, at most `limit` of them.
 * @example rankDocuments(index, "parse markdown", 10)
 */
export function rankDocuments(
	documents: readonly SearchDocument[],
	query: string,
	limit: number,
): SearchDocument[] {
	let tokens = tokenize(query);
	if (tokens.length === 0) return documents.slice(0, limit);

	let scored: Array<{ document: SearchDocument; score: number; order: number }> = [];

	for (let [order, document] of documents.entries()) {
		let total = 0;

		for (let token of tokens) {
			let score = scoreToken(document, token);
			if (score === 0) {
				total = 0;
				break;
			}
			total += score;
		}

		if (total > 0) scored.push({ document, score: total, order });
	}

	scored.sort((a, b) => b.score - a.score || a.order - b.order);

	return scored.slice(0, limit).map((entry) => entry.document);
}
