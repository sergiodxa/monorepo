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

/** One thing somebody asked for: a word or a quoted phrase, to find or to exclude. */
export interface SearchTerm {
	/** The word or phrase as typed, NFKC-normalized, with a phrase's inner whitespace collapsed. */
	text: string;
	/** Whether the term was quoted, so its words match consecutively and exactly. */
	phrase: boolean;
	/** Whether the term's last word matches any word it begins, so `sql` finds `sqlite`. */
	prefix: boolean;
	/** Whether a result holding this term is left out. */
	exclude: boolean;
}

/** A query ready to search with: at least one term to find, and any number to exclude. */
export interface ParsedQuery {
	/** The normalized, trimmed input the terms came from. */
	text: string;
	/** Every term in the order it was typed. */
	terms: SearchTerm[];
}

/** How a search box's text becomes terms. */
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
	 * Terms the query may hold, counting exclusions.
	 *
	 * @default 8
	 */
	maxTerms?: number;
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

/** A term as typed, before prefix rules apply. */
interface RawTerm {
	text: string;
	phrase: boolean;
	starred: boolean;
	exclude: boolean;
}

/**
 * Parses search box text into terms. Input is text, never syntax: `AND`, `OR`, `NEAR`,
 * `column:` and parentheses are ordinary words, a double-quoted run is a phrase (an
 * unclosed quote closes at the end), and a leading `-` excludes a term.
 *
 * Terms holding no letter or number are dropped, since a tokenizer keeps nothing of them.
 *
 * @param input What somebody typed.
 * @param options Prefix rule and size limits.
 * @returns The terms, `null` for a blank box, or a `ValidationError` for a query that is
 * too long, has too many terms, or leaves nothing to find once exclusions are set aside.
 * @example
 * parseQuery(`remix "route pattern" -legacy`); // success({ text, terms: [...] })
 * @example
 * parseQuery("   "); // success(null)
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

	let raw = tokenize(text).filter((term) => WORD_CHARACTER.test(term.text));

	let maxTerms = options.maxTerms ?? DEFAULT_MAX_QUERY_TERMS;
	if (raw.length > maxTerms) {
		return failure(invalid(`A search holds at most ${maxTerms} terms.`));
	}

	if (!raw.some((term) => !term.exclude)) {
		return failure(invalid("A search needs at least one term to find."));
	}

	let rule = options.prefix ?? "all";
	let terms = raw.map<SearchTerm>((term, index) => ({
		text: term.text,
		phrase: term.phrase,
		prefix:
			!term.phrase &&
			(term.starred || rule === "all" || (rule === "last" && index === raw.length - 1)),
		exclude: term.exclude,
	}));

	return success({ text, terms });
}

/** A `ValidationError` carrying one issue on the query itself. */
function invalid(message: string): ValidationError {
	return new ValidationError([{ message, path: ["q"] }]);
}

/**
 * Splits normalized text into terms, reading quotes and a leading `-` and nothing else.
 *
 * A quote inside a word belongs to the word, so `foo"bar` is one term; only a quote that
 * opens a term starts a phrase.
 */
function tokenize(text: string): RawTerm[] {
	let terms: RawTerm[] = [];
	let characters = Array.from(text);
	let index = 0;

	while (index < characters.length) {
		while (index < characters.length && SPACE.test(characters[index] ?? "")) index++;
		if (index >= characters.length) break;

		let exclude = characters[index] === "-";
		if (exclude) index++;

		if (characters[index] === '"') {
			index++;
			let start = index;
			while (index < characters.length && characters[index] !== '"') index++;
			let phrase = characters.slice(start, index).join("").split(/\s+/u).filter(Boolean);
			index++;
			terms.push({ text: phrase.join(" "), phrase: true, starred: false, exclude });
			continue;
		}

		let start = index;
		while (index < characters.length && !SPACE.test(characters[index] ?? "")) index++;
		let word = characters.slice(start, index).join("");
		let bare = word.replace(/\*+$/u, "");
		terms.push({ text: bare, phrase: false, starred: bare !== word, exclude });
	}

	return terms;
}

/**
 * Splits a text into matched and unmatched stretches. Matching mirrors `unicode61
 * remove_diacritics 2`: both sides are compared without case or diacritics, so `Résumé`
 * is highlighted as written when somebody typed `resume`. Excluded terms never highlight.
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
	return toSegments(text, matchRanges(text, query, options.mode ?? "word"), 0, text.length);
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
	let ranges = matchRanges(text, query, options.mode ?? "word");
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
 * Every span of `text` a positive term matched, sorted and merged so overlapping matches
 * render as one stretch.
 */
function matchRanges(text: string, query: ParsedQuery, mode: "word" | "substring"): Range[] {
	let folded = fold(text);
	let positives = query.terms.filter((term) => !term.exclude);
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
