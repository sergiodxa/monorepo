/**
 * Small string helper for the gallery that title-cases text. It capitalizes the first
 * letter of every word via a word-boundary regex, and exists to turn JSONPlaceholder's
 * lowercase album and photo titles into presentable display headings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Converts JSONPlaceholder lowercase titles into display titles.
 *
 * @param value Lowercase source title.
 * @returns A title-cased display string.
 */
export function titleCase(value: string): string {
	return value.replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}
