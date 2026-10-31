/**
 * Full-text search over every docs page's body, for readers who type what they're stuck on.
 * A question is reduced to its content words ("how do I get alerts on Slack" → alert, slack),
 * each word also matches its synonyms, and a result points at the section that answers it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Highlight } from "@sdxc/ui";

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { headings } from "@sdxc/markdown/plugin/headings";
import { isFailure } from "@sdxc/result";

import type { DocKind } from "~/app/services/docs";

import { docKind, loadDocSources, MARKDOWN_OPTIONS } from "~/app/services/docs";

/**
 * Words a question carries that say nothing about its subject, dropped before matching
 * so "why is my monitor down" searches for monitor and down.
 */
const STOP_WORDS = new Set([
	"a",
	"am",
	"an",
	"and",
	"are",
	"be",
	"can",
	"cant",
	"do",
	"does",
	"dont",
	"for",
	"from",
	"how",
	"i",
	"im",
	"in",
	"is",
	"it",
	"me",
	"my",
	"of",
	"on",
	"or",
	"should",
	"the",
	"to",
	"what",
	"when",
	"where",
	"which",
	"why",
	"with",
	"you",
	"your",
]);

/**
 * Groups of words readers use for the same thing. A query word matching any member of a
 * group also matches every other member, so "check" finds the monitor pages.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
	["monitor", "check", "probe"],
	["alert", "notification", "notify", "notified"],
	["down", "outage", "offline", "failing", "fails", "unreachable"],
	["email", "mail", "inbox"],
	["webhook", "hook", "callback"],
	["cron", "scheduled", "heartbeat", "job"],
	["status", "statuspage"],
	["maintenance", "downtime", "pause"],
	["invite", "teammate", "member", "colleague"],
	["key", "token"],
	["ssl", "tls", "certificate", "https"],
	["slow", "degraded", "latency", "timeout"],
	["flow", "login", "sign", "browser"],
	["delete", "remove"],
	["price", "pricing", "cost", "billing", "invoice", "pay"],
];

/** Where a match counts most: a title says what the page is about, a body may mention anything. */
const WEIGHTS = { title: 8, keywords: 6, heading: 4, description: 3, body: 1 } as const;

/** Characters of context a result shows around the match it found. */
const SNIPPET_LENGTH = 180;

/** One indexed section of a page: the intro under the title, a heading's span, or a step. */
interface IndexedSection {
	/** The anchor a result jumps to; the intro has none. */
	id: string | null;
	heading: string | null;
	text: string;
	words: string[];
	headingWords: string[];
}

/** One page as the index holds it. */
interface IndexedDoc {
	path: string;
	title: string;
	kind: DocKind;
	description: string;
	titleWords: string[];
	descriptionWords: string[];
	keywordWords: string[];
	sections: IndexedSection[];
}

/** One answer to a search, already split for highlighting. */
export interface DocsSearchResult {
	/** The page, with the anchor of the section that matched best. */
	href: string;
	path: string;
	title: Highlight.Segment[];
	kind: DocKind;
	/** The heading of the section that matched, when it isn't the page's intro. */
	section: string | null;
	snippet: Highlight.Segment[];
}

/** The search as the page reads it: the words it looked for and what it found. */
export interface DocsSearch {
	terms: string[];
	results: DocsSearchResult[];
}

/** The index, built on the first search an isolate serves and kept for the rest. */
const INDEX_CACHE = new Map<"docs", Promise<IndexedDoc[]>>();

/** Lowercases, strips accents and splits on anything that isn't a letter or a digit. */
export function tokenize(value: string): string[] {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 0);
}

/**
 * The words of a query worth matching, each with the synonyms it also matches. A query
 * made only of question words keeps them, so "how" still searches for something.
 */
export function queryTerms(query: string): string[][] {
	let words = tokenize(query);
	let content = words.filter((word) => !STOP_WORDS.has(word));
	let kept = content.length > 0 ? content : words;
	return Array.from(new Set(kept)).map((word) => {
		let group = SYNONYM_GROUPS.find((members) => members.some((member) => matches(member, word)));
		return group ? Array.from(new Set([word, ...group])) : [word];
	});
}

/**
 * Whether a document word answers a query word: the same word, or one it begins
 * ("alert" answers "alerts"), with a short query word held to a whole match.
 */
function matches(documentWord: string, queryWord: string): boolean {
	if (queryWord.length < 3) return documentWord === queryWord;
	return documentWord.startsWith(queryWord);
}

/** Whether any of `words` answers any alternative of one query term. */
function hits(words: readonly string[], alternatives: readonly string[]): boolean {
	return words.some((word) => alternatives.some((alternative) => matches(word, alternative)));
}

/**
 * Splits one page into its intro and the spans under each `h2`/`h3` and each step, as
 * plain text, so a result can jump to the part of the page that answers.
 */
function sectionsOf(document: Markdown.Document): IndexedSection[] {
	let sections: IndexedSection[] = [];
	let current = {
		id: null as string | null,
		heading: null as string | null,
		parts: [] as string[],
	};

	let close = () => {
		let text = current.parts.join(" ").replace(/\s+/g, " ").trim();
		if (text === "" && current.heading === null) return;
		sections.push({
			id: current.id,
			heading: current.heading,
			text,
			words: tokenize(text),
			headingWords: tokenize(current.heading ?? ""),
		});
	};

	let visit = (nodes: readonly Markdown.Node[]) => {
		for (let node of nodes) {
			if (node.type === "heading" && node.level <= 3 && typeof node.attributes.id === "string") {
				close();
				current = { id: node.attributes.id, heading: toPlainText(node), parts: [] };
				continue;
			}
			if (node.type === "tag" && node.name === "step") {
				close();
				let { id, title } = node.attributes;
				current = {
					id: typeof id === "string" ? id : null,
					heading: typeof title === "string" ? title : null,
					parts: [],
				};
				visit(node.children);
				continue;
			}
			if (node.type === "tag" && (node.name === "steps" || node.name === "faq")) {
				visit(node.children);
				continue;
			}
			if (node.type === "tag" && node.name === "question") {
				let { title } = node.attributes;
				if (typeof title === "string") current.parts.push(title);
				visit(node.children);
				continue;
			}
			current.parts.push(blockText(node));
		}
	};

	visit(document.children);
	close();
	return sections;
}

/**
 * A block's words as one run of text, with a list's items and a table's cells kept apart
 * by a separator, so a snippet never reads two neighbouring cells as one sentence.
 */
function blockText(node: Markdown.Node): string {
	if (node.type === "list") return node.children.map((item) => toPlainText(item)).join(" · ");
	if (node.type === "table") {
		return node.children
			.map((row) => row.children.map((cell) => toPlainText(cell)).join(" · "))
			.join(" · ");
	}
	return toPlainText(node);
}

/** Parses every bundled doc into the index; a doc that fails to parse is left out. */
async function buildIndex(): Promise<IndexedDoc[]> {
	let sources = await loadDocSources();
	let docs: IndexedDoc[] = [];

	for (let { path, source } of sources) {
		let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
		if (isFailure(parsed)) continue;
		let anchored = Markdown.walk(parsed.data.document, headings());
		let document = isFailure(anchored) ? parsed.data.document : anchored.data;
		let { frontmatter } = parsed.data;

		docs.push({
			path,
			title: frontmatter.title,
			kind: docKind(path),
			description: frontmatter.description,
			titleWords: tokenize(frontmatter.title),
			descriptionWords: tokenize(frontmatter.description),
			keywordWords: tokenize((frontmatter.keywords ?? []).join(" ")),
			sections: sectionsOf(document),
		});
	}

	return docs;
}

/** The index, built once per isolate. */
function getIndex(): Promise<IndexedDoc[]> {
	let cached = INDEX_CACHE.get("docs");
	if (cached) return cached;
	let built = buildIndex();
	INDEX_CACHE.set("docs", built);
	return built;
}

/** How well one section answers the query, counting heading matches over body mentions. */
function sectionScore(section: IndexedSection, terms: readonly string[][]): number {
	return terms.reduce((score, alternatives) => {
		if (hits(section.headingWords, alternatives)) return score + WEIGHTS.heading;
		if (hits(section.words, alternatives)) return score + WEIGHTS.body;
		return score;
	}, 0);
}

/**
 * How well a page answers the query, or `null` when some query word appears nowhere in
 * it: every word the reader typed (or one of its synonyms) has to be on the page.
 */
function docScore(doc: IndexedDoc, terms: readonly string[][]): number | null {
	let score = 0;
	for (let alternatives of terms) {
		let best = 0;
		if (hits(doc.titleWords, alternatives)) best = WEIGHTS.title;
		else if (hits(doc.keywordWords, alternatives)) best = WEIGHTS.keywords;
		else if (doc.sections.some((section) => hits(section.headingWords, alternatives)))
			best = WEIGHTS.heading;
		else if (hits(doc.descriptionWords, alternatives)) best = WEIGHTS.description;
		else if (doc.sections.some((section) => hits(section.words, alternatives))) best = WEIGHTS.body;
		if (best === 0) return null;
		score += best;
	}
	return score;
}

/**
 * Splits `text` into runs, marking each word that answers a query term, so the result
 * highlights exactly the words that matched.
 */
export function highlightSegments(text: string, terms: readonly string[][]): Highlight.Segment[] {
	let segments: Highlight.Segment[] = [];
	for (let part of text.split(/([\p{L}\p{N}’']+)/u)) {
		if (part === "") continue;
		let word = tokenize(part)[0];
		let match = word !== undefined && terms.some((alternatives) => hits([word], alternatives));
		let last = segments.at(-1);
		if (last && last.match === match) last.text += part;
		else segments.push({ text: part, match });
	}
	return segments;
}

/**
 * The stretch of a section around its first match, cut at word boundaries and marked
 * with an ellipsis where it was cut.
 */
function snippetOf(text: string, terms: readonly string[][]): string {
	if (text.length <= SNIPPET_LENGTH) return text;
	let lower = text.toLowerCase();
	let positions = terms
		.flat()
		.map((alternative) =>
			lower.search(new RegExp(`(^|[^\\p{L}\\p{N}])${escape(alternative)}`, "u")),
		)
		.filter((position) => position >= 0);
	let first = positions.length > 0 ? Math.min(...positions) : 0;
	let start = Math.max(0, first - 50);
	let end = Math.min(text.length, start + SNIPPET_LENGTH);
	let slice = text.slice(start, end);
	if (start > 0) slice = `…${slice.slice(slice.indexOf(" ") + 1)}`;
	if (end < text.length) slice = `${slice.slice(0, slice.lastIndexOf(" "))}…`;
	return slice;
}

/** Escapes a word for use inside a regular expression. */
function escape(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Searches every page for `query`, best answers first: a page needs every content word
 * (or a synonym), titles and headings outrank body mentions, and each result names and
 * links the section that matched best.
 *
 * @example await searchDocs("how do I get alerts on Slack")
 */
export async function searchDocs(query: string): Promise<DocsSearch> {
	let terms = queryTerms(query);
	if (terms.length === 0) return { terms: [], results: [] };

	let index = await getIndex();
	let scored: Array<{ doc: IndexedDoc; score: number }> = [];
	for (let doc of index) {
		let score = docScore(doc, terms);
		if (score !== null) scored.push({ doc, score });
	}
	scored.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));

	let results = scored.map(({ doc }): DocsSearchResult => {
		let ranked = doc.sections
			.map((section) => ({ section, score: sectionScore(section, terms) }))
			.sort((a, b) => b.score - a.score);
		let best = ranked[0]?.score ? ranked[0].section : null;
		let text = best?.text || doc.description;
		return {
			href: best?.id ? `${doc.path}#${best.id}` : doc.path,
			path: doc.path,
			title: highlightSegments(doc.title, terms),
			kind: doc.kind,
			section: best?.heading ?? null,
			snippet: highlightSegments(snippetOf(text, terms), terms),
		};
	});

	return { terms: terms.map((alternatives) => alternatives[0] ?? ""), results };
}
