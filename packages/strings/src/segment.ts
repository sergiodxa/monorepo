/**
 * Grapheme and word segmentation helpers built on `Intl.Segmenter`, so a
 * "character" in this package always means a user-perceived grapheme
 * cluster. Segmenters are memoized per locale because building one costs
 * far more than segmenting a short string, and the text helpers run once
 * per record in list views.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const GRAPHEME_SEGMENTERS = new Map<string, Intl.Segmenter>();

const WORD_SEGMENTERS = new Map<string, Intl.Segmenter>();

/**
 * Builds a stable cache key for a locale argument that may be undefined, a
 * tag, an `Intl.Locale`, or a list of either.
 */
function localeKey(locale?: Intl.LocalesArgument): string {
	let tags = localeTags(locale);
	return tags === undefined ? "" : tags.join(",");
}

/**
 * Normalizes a locale argument into plain tags, which is the shape
 * `toLocaleUpperCase` and `toLocaleLowerCase` accept.
 */
function localeTags(locale?: Intl.LocalesArgument): string[] | undefined {
	if (locale === undefined) return undefined;
	if (Array.isArray(locale)) return locale.map((item) => String(item));
	return [String(locale)];
}

/**
 * Returns a grapheme-granularity segmenter for the locale, reusing the cached
 * instance when one was already built for the same locale.
 */
export function graphemeSegmenter(locale?: Intl.LocalesArgument): Intl.Segmenter {
	let key = localeKey(locale);
	let cached = GRAPHEME_SEGMENTERS.get(key);
	if (cached) return cached;
	let segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
	GRAPHEME_SEGMENTERS.set(key, segmenter);
	return segmenter;
}

/**
 * Returns a word-granularity segmenter for the locale, reusing the cached
 * instance when one was already built for the same locale.
 */
export function wordSegmenter(locale?: Intl.LocalesArgument): Intl.Segmenter {
	let key = localeKey(locale);
	let cached = WORD_SEGMENTERS.get(key);
	if (cached) return cached;
	let segmenter = new Intl.Segmenter(locale, { granularity: "word" });
	WORD_SEGMENTERS.set(key, segmenter);
	return segmenter;
}

/**
 * Splits a string into grapheme clusters, keeping emoji sequences and a base
 * letter with its combining marks together as single entries.
 */
export function graphemes(value: string, locale?: Intl.LocalesArgument): string[] {
	let result: string[] = [];
	for (let { segment } of graphemeSegmenter(locale).segment(value)) result.push(segment);
	return result;
}

/**
 * Counts grapheme clusters, the only length a reader agrees with when a string
 * contains emoji or combining marks.
 */
export function countGraphemes(value: string, locale?: Intl.LocalesArgument): number {
	let iterator = graphemeSegmenter(locale).segment(value)[Symbol.iterator]();
	let total = 0;
	while (!iterator.next().done) total += 1;
	return total;
}

/**
 * Returns the word-like segments of a string, dropping whitespace and
 * punctuation segments so callers only ever see actual words.
 */
export function words(value: string, locale?: Intl.LocalesArgument): string[] {
	let result: string[] = [];
	for (let { segment, isWordLike } of wordSegmenter(locale).segment(value)) {
		if (isWordLike) result.push(segment);
	}
	return result;
}

/**
 * Uppercases the first grapheme cluster and leaves the rest of the string as
 * written, so casing an author chose inside a word survives.
 *
 * @example upperFirst("iPhone") // "IPhone", which is why `special` lists exist
 */
export function upperFirst(value: string, locale?: Intl.LocalesArgument): string {
	return replaceFirstGrapheme(
		value,
		(first) => {
			let tags = localeTags(locale);
			return tags === undefined ? first.toUpperCase() : first.toLocaleUpperCase(tags);
		},
		locale,
	);
}

/**
 * Lowercases the first grapheme cluster and leaves the rest of the string as
 * written, used to turn an already cased word into a camelCase head.
 */
export function lowerFirst(value: string, locale?: Intl.LocalesArgument): string {
	return replaceFirstGrapheme(
		value,
		(first) => {
			let tags = localeTags(locale);
			return tags === undefined ? first.toLowerCase() : first.toLocaleLowerCase(tags);
		},
		locale,
	);
}

/**
 * Applies a transform to the first grapheme cluster only, returning the input
 * untouched when it is empty so every call site can treat both cases alike.
 */
function replaceFirstGrapheme(
	value: string,
	transform: (first: string) => string,
	locale?: Intl.LocalesArgument,
): string {
	if (value.length === 0) return value;
	let [first] = graphemeSegmenter(locale).segment(value);
	if (first === undefined) return value;
	return transform(first.segment) + value.slice(first.segment.length);
}
