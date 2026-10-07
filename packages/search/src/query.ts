/**
 * What somebody typed into a search box, parsed into terms, and the highlighting that
 * shows which words of a result those terms matched. It imports no database module, so
 * a browser bundle can parse and highlight with the same code the server searches with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";

/** Characters a query may hold after normalization when `maxLength` is not given. */
export const DEFAULT_MAX_QUERY_LENGTH = 256;

/** Terms a query may hold when `maxTerms` is not given; it keeps a `LIKE` statement inside 100 bound parameters. */
export const DEFAULT_MAX_QUERY_TERMS = 8;

/** Words an excerpt holds when `words` is not given. */
const DEFAULT_EXCERPT_WORDS = 24;

/** A letter or a number, which is what a term needs to hold for a tokenizer to keep any of it. */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** A run of letters and numbers, the unit `unicode61` indexes and highlighting compares. */
const WORD = /[\p{L}\p{N}]+/gu;

/** A combining mark, which `remove_diacritics 2` strips before comparing. */
const COMBINING_MARK = /\p{M}/u;

/** Whitespace, which separates terms outside a quoted phrase. */
const SPACE = /\s/u;

/** One word or phrase somebody asked for, in every column or in one declared field. */
export interface SearchTerm {
	/** The word or phrase as typed, NFKC-normalized, with a phrase's inner whitespace collapsed. */
	text: string;
	/** Whether the term was quoted, so its words match consecutively and exactly. */
	phrase: boolean;
	/** Whether the term's last word matches any word it begins, so `sql` finds `sqlite`. */
	prefix: boolean;
	/** The declared field the term was scoped to with `field:`, lowercased, or `null` for every column. */
	field: string | null;
}

/**
 * Terms of which a match needs any one: a single term, or the alternatives an `OR` joined.
 * An excluded clause holds exactly one term, and leaves out every result holding it.
 */
export interface SearchClause {
	/** The alternatives, in the order they were typed. */
	terms: SearchTerm[];
	/** Whether a result holding the term is left out instead of required. */
	exclude: boolean;
}

/**
 * An exact value for a declared filter, such as `tag:"react router"`. Filters never reach
 * the search statement: the caller applies them as `where`, since only it knows the schema.
 */
export interface SearchFilter {
	/** The declared filter's name, lowercased. */
	name: string;
	/** The values, of which a result needs any one; NFKC-normalized and never tokenized. */
	values: string[];
	/** Whether results matching a value are left out instead of required. */
	exclude: boolean;
}

/**
 * A query ready to search with: every clause must match and every filter must hold, and
 * at least one clause or filter is positive.
 */
export interface ParsedQuery {
	/** The normalized, trimmed input the query came from. */
	text: string;
	/** Text to match, in the order it was typed. */
	clauses: SearchClause[];
	/** Exact-value filters, in the order they were typed. */
	filters: SearchFilter[];
}

/** How a search box's text becomes clauses and filters. */
export interface ParseQueryOptions {
	/**
	 * Which words match as prefixes: every word, only the last one (search as you type),
	 * or none. A trailing `*` makes its own word a prefix whatever this says.
	 *
	 * @default "all"
	 */
	prefix?: "all" | "last" | "none";
	/**
	 * Characters the normalized query may hold.
	 *
	 * @default 256
	 */
	maxLength?: number;
	/**
	 * Terms and filter values the query may hold, counting exclusions.
	 *
	 * @default 8
	 */
	maxTerms?: number;
	/**
	 * Names that scope a term to one text field (`title:remix`), usually a definition's
	 * `fields`. Any other `name:value` stays an ordinary word.
	 */
	fields?: readonly string[];
	/** Names that read an exact value (`tag:"react router"`) for the caller to filter by. */
	filters?: readonly string[];
}

/** One stretch of a highlighted text: either a match or the text between matches. */
export interface HighlightSegment {
	/** The original text of this stretch, exactly as written. */
	text: string;
	/** Whether a term matched this stretch. */
	match: boolean;
}

/** How highlighting compares terms against a text. */
export interface HighlightOptions {
	/**
	 * `"word"` matches whole words and word prefixes, as `unicode61` does; `"substring"`
	 * matches anywhere, as `LIKE` and `trigram` do.
	 *
	 * @default "word"
	 */
	mode?: "word" | "substring";
	/**
	 * The declared field this text is, so terms scoped to it highlight here; a term scoped to
	 * another field never does. Unscoped terms highlight in every text.
	 */
	field?: string;
}

/** How long an excerpt is, and how it compares terms. */
export interface ExcerptOptions extends HighlightOptions {
	/**
	 * Whitespace-separated words the excerpt holds.
	 *
	 * @default 24
	 */
	words?: number;
}

/** A window of a longer text around its first match, highlighted. */
export interface Excerpt {
	/** The window's text, split into matched and unmatched stretches. */
	segments: HighlightSegment[];
	/** Whether text precedes the window, so a renderer can lead with an ellipsis. */
	truncatedStart: boolean;
	/** Whether text follows the window, so a renderer can end with an ellipsis. */
	truncatedEnd: boolean;
}

/** A term or filter as typed, before `OR` grouping and prefix rules apply. */
interface Token {
	kind: "term" | "filter";
	text: string;
	phrase: boolean;
	starred: boolean;
	exclude: boolean;
	/** The field a term is scoped to, or the filter's name. */
	name: string | null;
	/** Whether an `OR` came right before this token. */
	afterOr: boolean;
}

/**
 * Parses search box text with a Lucene-style syntax read leniently: words must all match,
 * `"quoted"` runs are phrases, `-word` or `NOT word` excludes, `a OR b` accepts either,
 * `+` and `AND` are accepted, and a declared `field:value` or `filter:value` scopes or
 * filters. Anything the syntax cannot place falls back to text, so input never fails for it.
 *
 * Terms holding no letter or number are dropped, since a tokenizer keeps nothing of them.
 *
 * @param input What somebody typed.
 * @param options Prefix rule, size limits, and the declared fields and filters.
 * @returns The query, `null` for a blank box, or a `ValidationError` for a query that is too
 * long, has too many terms, or leaves nothing to find once exclusions are set aside.
 * @example
 * parseQuery(`remix OR react "route pattern" -legacy`); // success({ text, clauses, filters })
 * @example
 * parseQuery(`tag:"react router"`, { filters: ["tag"] }); // success({ clauses: [], filters: [...] })
 */
export function parseQuery(
	input: string,
	options: ParseQueryOptions = {},
): Result<ParsedQuery | null, ValidationError> {
	let text = input.normalize("NFKC").trim();
	if (text.length === 0) return success(null);

	let maxLength = options.maxLength ?? DEFAULT_MAX_QUERY_LENGTH;
	if (text.length > maxLength) {
		return failure(invalid(`A search holds at most ${maxLength} characters.`));
	}

	let fields = new Set((options.fields ?? []).map((name) => name.toLowerCase()));
	let filterNames = new Set((options.filters ?? []).map((name) => name.toLowerCase()));
	let tokens = tokenize(text, fields, filterNames);

	let maxTerms = options.maxTerms ?? DEFAULT_MAX_QUERY_TERMS;
	if (tokens.length > maxTerms) {
		return failure(invalid(`A search holds at most ${maxTerms} terms.`));
	}

	let lastTerm = tokens.reduce(
		(found, token, index) => (token.kind === "term" ? index : found),
		-1,
	);
	let rule = options.prefix ?? "all";
	let clauses: SearchClause[] = [];
	let filters: SearchFilter[] = [];
	let previous: Token | null = null;

	for (let [index, token] of tokens.entries()) {
		let joins = token.afterOr && previous !== null && canJoin(previous, token);

		if (token.kind === "filter") {
			let value = token.text;
			let last = filters[filters.length - 1];
			if (joins && last !== undefined) last.values.push(value);
			else filters.push({ name: token.name ?? "", values: [value], exclude: token.exclude });
		} else {
			let term: SearchTerm = {
				text: token.text,
				phrase: token.phrase,
				prefix:
					!token.phrase &&
					(token.starred || rule === "all" || (rule === "last" && index === lastTerm)),
				field: token.name,
			};
			let last = clauses[clauses.length - 1];
			if (joins && last !== undefined) last.terms.push(term);
			else clauses.push({ terms: [term], exclude: token.exclude });
		}

		previous = token;
	}

	let searchable =
		clauses.some((clause) => !clause.exclude) || filters.some((filter) => !filter.exclude);
	if (!searchable) return failure(invalid("A search needs at least one term to find."));

	return success({ text, clauses, filters });
}

/**
 * Whether an `OR` joins two tokens into one group: positive terms join terms, and positive
 * filters join filters of the same name. Any other pairing reads the `OR` as nothing, so
 * both stay required.
 */
function canJoin(previous: Token, next: Token): boolean {
	if (previous.exclude || next.exclude || previous.kind !== next.kind) return false;
	return next.kind === "term" || previous.name === next.name;
}

/** A `ValidationError` carrying one issue on the query itself. */
function invalid(message: string): ValidationError {
	return new ValidationError([{ message, path: ["q"] }]);
}

/** A `name:` that may qualify a term, read up to the colon. */
const QUALIFIER = /^([\p{L}\p{N}_-]+):/u;

/**
 * Splits normalized text into tokens. Uppercase `OR`, `AND` and `NOT` are operators, `-`
 * and `+` prefix a token, and a declared `name:` qualifies the word or phrase after it.
 * A quote inside a word belongs to the word, so `foo"bar` is one term; only a quote that
 * opens a token starts a phrase, and an unclosed one closes at the end.
 */
function tokenize(
	text: string,
	fields: ReadonlySet<string>,
	filters: ReadonlySet<string>,
): Token[] {
	let tokens: Token[] = [];
	let characters = Array.from(text);
	let index = 0;
	let pendingOr = false;
	let pendingNot = false;

	while (index < characters.length) {
		while (index < characters.length && SPACE.test(characters[index] ?? "")) index++;
		if (index >= characters.length) break;

		let sign = characters[index];
		let exclude = pendingNot || sign === "-";
		if (sign === "-" || sign === "+") index++;

		let name: string | null = null;
		let kind: Token["kind"] = "term";
		let qualifier = QUALIFIER.exec(characters.slice(index).join(""));
		let qualified = qualifier?.[1]?.toLowerCase();
		let valueStart = index + Array.from(qualifier?.[0] ?? "").length;
		let hasValue = valueStart < characters.length && !SPACE.test(characters[valueStart] ?? "");

		if (qualified !== undefined && hasValue && (fields.has(qualified) || filters.has(qualified))) {
			name = qualified;
			kind = filters.has(qualified) ? "filter" : "term";
			index = valueStart;
		}

		let read = readValue(characters, index);
		index = read.next;

		let operator = name === null && sign !== "-" && sign !== "+" && !read.phrase;
		if (operator && read.raw === "OR") {
			pendingOr = true;
			continue;
		}
		if (operator && read.raw === "AND") continue;
		if (operator && read.raw === "NOT") {
			pendingNot = true;
			continue;
		}

		let value = kind === "filter" ? read.raw : read.text;
		let starred = kind === "term" && !read.phrase && value !== read.raw;
		pendingNot = false;

		if (kind === "term" && !WORD_CHARACTER.test(value)) continue;
		if (value.length === 0) continue;

		tokens.push({
			kind,
			text: value,
			phrase: read.phrase,
			starred,
			exclude,
			name,
			afterOr: pendingOr,
		});
		pendingOr = false;
	}

	return tokens;
}

/** One word or quoted phrase read from `start`, and where reading stopped. */
interface ReadValue {
	/** The value with a phrase's whitespace collapsed and a word's trailing `*` removed. */
	text: string;
	/** The value as typed, with a phrase's whitespace collapsed. */
	raw: string;
	phrase: boolean;
	next: number;
}

/** Reads the word or quoted phrase that starts at `start`. */
function readValue(characters: readonly string[], start: number): ReadValue {
	if (characters[start] === '"') {
		let end = start + 1;
		while (end < characters.length && characters[end] !== '"') end++;
		let phrase = characters
			.slice(start + 1, end)
			.join("")
			.split(/\s+/u)
			.filter(Boolean)
			.join(" ");
		return { text: phrase, raw: phrase, phrase: true, next: end + 1 };
	}

	let end = start;
	while (end < characters.length && !SPACE.test(characters[end] ?? "")) end++;
	let word = characters.slice(start, end).join("");
	return { text: word.replace(/\*+$/u, ""), raw: word, phrase: false, next: end };
}

/**
 * Splits a text into matched and unmatched stretches. Matching mirrors `unicode61
 * remove_diacritics 2`: both sides are compared without case or diacritics, so `Résumé`
 * is highlighted as written when somebody typed `resume`. Excluded terms and filters never
 * highlight, and a scoped term highlights only the field it names.
 *
 * @param text The text to highlight, usually a column of a search result.
 * @param query The query the result was found with.
 * @param options Whether terms match words or substrings.
 * @returns Every stretch of `text` in order, whose texts concatenate back to `text`.
 * @example
 * highlight("Remix Route Pattern basics", parsed); // [{ text: "Remix", match: true }, ...]
 */
export function highlight(
	text: string,
	query: ParsedQuery,
	options: HighlightOptions = {},
): HighlightSegment[] {
	return toSegments(text, matchRanges(text, query, options), 0, text.length);
}

/**
 * A window of `words` words around the first match in `text`, highlighted, for showing a
 * long column beside a result. A text without a match yields its opening words.
 *
 * @param text The long text to cut a window from.
 * @param query The query the result was found with.
 * @param options Window size and match mode.
 * @returns The window's stretches and whether text was cut on either side.
 * @example
 * excerpt(article.body, parsed, { words: 24 }); // { segments, truncatedStart: true, truncatedEnd: false }
 */
export function excerpt(text: string, query: ParsedQuery, options: ExcerptOptions = {}): Excerpt {
	let size = Math.max(1, Math.trunc(options.words ?? DEFAULT_EXCERPT_WORDS));
	let ranges = matchRanges(text, query, options);
	let words = [...text.matchAll(/\S+/gu)].map((found) => ({
		start: found.index,
		end: found.index + found[0].length,
	}));

	let first = words[0];
	let last = words[words.length - 1];
	if (first === undefined || last === undefined) {
		return { segments: [], truncatedStart: false, truncatedEnd: false };
	}

	let anchor = ranges[0];
	let matched =
		anchor === undefined
			? 0
			: Math.max(
					0,
					words.findIndex((word) => word.end > anchor.start),
				);
	let lead = Math.floor(size / 4);
	let from = Math.max(0, Math.min(matched - lead, words.length - size));
	let to = Math.min(words.length, from + size);

	let start = words[from]?.start ?? first.start;
	let end = words[to - 1]?.end ?? last.end;

	return {
		segments: toSegments(text, ranges, start, end),
		truncatedStart: start > first.start,
		truncatedEnd: end < last.end,
	};
}

/** A half-open span of the original text a term matched. */
interface Range {
	start: number;
	end: number;
}

/**
 * A text folded for comparison, with each folded character's span in the original, so a
 * match found in the folded text maps back to exactly what was written.
 */
interface Folded {
	text: string;
	starts: number[];
	ends: number[];
}

/**
 * Folds a text the way `remove_diacritics 2` compares it: decomposed, stripped of
 * combining marks and lowercased, one original code point at a time.
 */
function fold(text: string): Folded {
	let folded = "";
	let starts: number[] = [];
	let ends: number[] = [];
	let offset = 0;

	for (let character of text) {
		let end = offset + character.length;
		let plain = Array.from(character.normalize("NFD").toLowerCase().normalize("NFD"))
			.filter((part) => !COMBINING_MARK.test(part))
			.join("");

		for (let unit = 0; unit < plain.length; unit++) {
			starts.push(offset);
			ends.push(end);
		}

		folded += plain;
		offset = end;
	}

	return { text: folded, starts, ends };
}

/** Folds a term's text with no offsets kept, since only the document's offsets matter. */
function foldTerm(text: string): string {
	return fold(text).text;
}

/**
 * Every span of `text` a positive term matched, every alternative of an `OR` included,
 * sorted and merged so overlapping matches render as one stretch.
 */
function matchRanges(text: string, query: ParsedQuery, options: HighlightOptions): Range[] {
	let folded = fold(text);
	let mode = options.mode ?? "word";
	let field = options.field?.toLowerCase() ?? null;
	let positives = query.clauses
		.filter((clause) => !clause.exclude)
		.flatMap((clause) => clause.terms)
		.filter((term) => term.field === null || term.field === field);
	let found =
		mode === "word" ? wordMatches(folded, positives) : substringMatches(folded, positives);

	return merge(
		found
			.map((range) => toOriginal(text, folded, range))
			.filter((range) => range.end > range.start),
	);
}

/**
 * Spans where a term's words appear consecutively among the text's words, the last one
 * as a prefix when the term is one. A prefix match spans the whole word it began, so `sql`
 * highlights all of `SQLite`. Offsets are into the folded text.
 */
function wordMatches(folded: Folded, terms: readonly SearchTerm[]): Range[] {
	let words = [...folded.text.matchAll(WORD)].map((found) => ({
		text: found[0],
		start: found.index,
		end: found.index + found[0].length,
	}));
	let ranges: Range[] = [];

	for (let term of terms) {
		let needle = foldTerm(term.text).match(WORD) ?? [];
		if (needle.length === 0) continue;

		for (let index = 0; index + needle.length <= words.length; index++) {
			let matches = needle.every((part, offset) => {
				let word = words[index + offset];
				if (word === undefined) return false;
				let isLast = offset === needle.length - 1;
				return term.prefix && isLast ? word.text.startsWith(part) : word.text === part;
			});

			let first = words[index];
			let last = words[index + needle.length - 1];
			if (matches && first !== undefined && last !== undefined) {
				ranges.push({ start: first.start, end: last.end });
			}
		}
	}

	return ranges;
}

/** Spans where a term's folded text appears anywhere. Offsets are into the folded text. */
function substringMatches(folded: Folded, terms: readonly SearchTerm[]): Range[] {
	let ranges: Range[] = [];

	for (let term of terms) {
		let needle = foldTerm(term.text);
		if (needle.length === 0) continue;

		let from = folded.text.indexOf(needle);
		while (from !== -1) {
			ranges.push({ start: from, end: from + needle.length });
			from = folded.text.indexOf(needle, from + 1);
		}
	}

	return ranges;
}

/**
 * Maps a span of the folded text back to the original, carrying any combining marks that
 * follow it so a decomposed `é` is never split from its accent.
 */
function toOriginal(text: string, folded: Folded, range: Range): Range {
	let start = folded.starts[range.start] ?? text.length;
	let end = folded.ends[range.end - 1] ?? start;

	while (end < text.length) {
		let next = String.fromCodePoint(text.codePointAt(end) ?? 0);
		if (!COMBINING_MARK.test(next)) break;
		end += next.length;
	}

	return { start, end };
}

/** Sorts spans and merges every pair that overlaps or touches. */
function merge(ranges: Range[]): Range[] {
	let sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
	let merged: Range[] = [];

	for (let range of sorted) {
		let previous = merged[merged.length - 1];
		if (previous !== undefined && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}

	return merged;
}

/** Cuts `text[from, to)` into alternating stretches, clipping matches at the window's edges. */
function toSegments(
	text: string,
	ranges: readonly Range[],
	from: number,
	to: number,
): HighlightSegment[] {
	let segments: HighlightSegment[] = [];
	let cursor = from;

	for (let range of ranges) {
		let start = Math.max(range.start, from);
		let end = Math.min(range.end, to);
		if (end <= start) continue;

		if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
		segments.push({ text: text.slice(start, end), match: true });
		cursor = end;
	}

	if (cursor < to) segments.push({ text: text.slice(cursor, to), match: false });

	return segments;
}
