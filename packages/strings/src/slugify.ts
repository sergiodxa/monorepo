/**
 * URL slug generation with one Unicode-aware implementation, so a slug written
 * by a CMS form matches the slug a background job derives from the same title.
 * Input is normalized to NFKD and combining marks are dropped, which folds
 * accented Latin letters onto their base letter without a transliteration table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Combining marks, removed after NFKD so `"ó"` decomposes down to `"o"`. */
const COMBINING_MARKS = /\p{M}+/gu;

const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Options for {@link slugify}. */
export interface SlugifyOptions {
	/**
	 * String that joins the words of the slug, also stripped from both ends.
	 * Defaults to `"-"`; pass `""` to join the words with nothing.
	 */
	separator?: string;
}

/** Escapes a literal separator so it can be embedded in a generated pattern. */
function escapePattern(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a URL-safe slug: lowercases, folds diacritics via NFKD, and collapses
 * non-alphanumeric runs into the separator. Letters outside Latin stay as
 * letters, so a non-Latin title still yields a usable slug.
 *
 * @param value - Text to slugify
 * @param options - Separator to join the words with
 * @returns The slug, or an empty string when the input has no letters or digits
 * @example slugify("Cómo usar Remix v3") // "como-usar-remix-v3"
 * @example slugify("Hello, World!", { separator: "_" }) // "hello_world"
 */
export function slugify(value: string, options: SlugifyOptions = {}): string {
	let separator = options.separator ?? "-";

	let slug = value
		.normalize("NFKD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(NON_ALPHANUMERIC, separator);

	if (separator.length === 0) return slug;

	let escaped = escapePattern(separator);
	return slug
		.replace(new RegExp(`(?:${escaped})+`, "gu"), separator)
		.replace(new RegExp(`^(?:${escaped})+|(?:${escaped})+$`, "gu"), "");
}
