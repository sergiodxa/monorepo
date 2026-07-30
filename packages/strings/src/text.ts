/**
 * Text operations that measure and cut strings in grapheme clusters and words
 * through `Intl.Segmenter`, instead of in UTF-16 code units. Slicing by code
 * unit splits emoji sequences and separates a letter from its combining marks,
 * which is what makes a truncated excerpt render as a broken glyph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { countGraphemes, graphemes, upperFirst, words, wordSegmenter } from "./segment";

/** Runs of whitespace, collapsed by {@link excerpt} before truncating. */
const WHITESPACE_RUN = /\s+/gu;

/** Trailing whitespace, trimmed before the omission marker is appended. */
const TRAILING_WHITESPACE = /\s+$/u;

/** Options shared by every helper that segments text. */
export interface LocaleOptions {
	/** Locale driving segmentation; defaults to the runtime's default locale. */
	locale?: Intl.LocalesArgument;
}

/** Options for {@link truncate}. */
export interface TruncateOptions extends LocaleOptions {
	/** Maximum number of grapheme clusters in the result, omission included. */
	length: number;
	/** Cut at a word boundary instead of mid-word. Defaults to `false`. */
	words?: boolean;
	/** Marker appended when the text was cut. Defaults to `"…"`. */
	omission?: string;
}

/** Options for {@link excerpt}. */
export interface ExcerptOptions extends LocaleOptions {
	/** Maximum number of grapheme clusters in the result, omission included. */
	length: number;
	/** Cut at a word boundary instead of mid-word. Defaults to `true`. */
	words?: boolean;
	/** Marker appended when the text was cut. Defaults to `"…"`. */
	omission?: string;
}

/** Options for {@link initials}. */
export interface InitialsOptions extends LocaleOptions {
	/** How many initials to keep. Defaults to `2`. */
	limit?: number;
}

/**
 * Keeps whole word segments while they fit the grapheme budget, so a cut never
 * lands inside a word. Returns an empty string when the first word alone is
 * already longer than the budget, which callers treat as "no boundary found".
 */
function takeWholeWords(value: string, budget: number, locale?: Intl.LocalesArgument): string {
	let result = "";
	let used = 0;

	for (let { segment } of wordSegmenter(locale).segment(value)) {
		let size = countGraphemes(segment, locale);
		if (used + size > budget) break;
		result += segment;
		used += size;
	}

	return result;
}

/**
 * Truncates text to a maximum number of grapheme clusters, appending the
 * omission marker only when something was actually cut. The marker counts
 * towards the limit, so the result never exceeds `length` clusters.
 *
 * @param text - Text to truncate
 * @param options - Limit, word-boundary behavior, omission marker, and locale
 * @returns The text unchanged when it already fits, otherwise the cut text
 * @example truncate("a long sentence", { length: 10 }) // "a long se…"
 * @example truncate("a long sentence", { length: 10, words: true }) // "a long…"
 */
export function truncate(text: string, options: TruncateOptions): string {
	let { length, locale, omission = "…", words: atWordBoundary = false } = options;
	if (length <= 0) return "";

	let clusters = graphemes(text, locale);
	if (clusters.length <= length) return text;

	let omissionLength = countGraphemes(omission, locale);
	if (omissionLength >= length) return clusters.slice(0, length).join("");

	let budget = length - omissionLength;
	let head = clusters.slice(0, budget).join("");

	if (atWordBoundary) {
		let atBoundary = takeWholeWords(text, budget, locale);
		if (atBoundary.length > 0) head = atBoundary;
	}

	return head.replace(TRAILING_WHITESPACE, "") + omission;
}

/**
 * Collapses every run of whitespace into a single space and then truncates,
 * which turns multi-paragraph source text into a one-line summary. Unlike
 * {@link truncate} it cuts at a word boundary by default.
 *
 * @param text - Text to summarize
 * @param options - Limit, word-boundary behavior, omission marker, and locale
 * @example excerpt("Long\n\npost body", { length: 200 })
 */
export function excerpt(text: string, options: ExcerptOptions): string {
	let collapsed = text.replace(WHITESPACE_RUN, " ").trim();
	return truncate(collapsed, { ...options, words: options.words ?? true });
}

/**
 * Counts words the way a reader would, using word-boundary segmentation instead
 * of splitting on spaces, so scripts written without spaces still get a count.
 *
 * @param text - Text to count
 * @param options - Locale driving word segmentation
 * @example wordCount("Hello, world!") // 2
 */
export function wordCount(text: string, options: LocaleOptions = {}): number {
	return words(text, options.locale).length;
}

/**
 * Builds initials from a name by taking the first grapheme cluster of each word,
 * uppercased. Defaults to two initials, the avatar case; pass `limit` to keep
 * more of a longer name.
 *
 * @param name - Name to reduce to initials
 * @param options - How many initials to keep, and the locale
 * @example initials("Sergio Xalambrí") // "SX"
 * @example initials("Ada Byron King", { limit: 3 }) // "ABK"
 */
export function initials(name: string, options: InitialsOptions = {}): string {
	let { limit = 2, locale } = options;
	if (limit <= 0) return "";

	return words(name, locale)
		.slice(0, limit)
		.map((word) => upperFirst(graphemes(word, locale)[0] ?? "", locale))
		.join("");
}

/**
 * Uppercases the first grapheme cluster and leaves the rest untouched, so an
 * acronym or an intentionally cased word keeps the casing its author chose.
 *
 * @param value - Text to capitalize
 * @param options - Locale driving the uppercase mapping
 * @example capitalize("remix") // "Remix"
 * @example capitalize("iOS release") // "IOS release", so prefer `special` lists
 */
export function capitalize(value: string, options: LocaleOptions = {}): string {
	return upperFirst(value, options.locale);
}
