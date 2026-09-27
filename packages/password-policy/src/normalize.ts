/**
 * The one normalization every check and the bundled list share: NFKC, so visually
 * identical spellings compare equal, then lowercase for the comparisons. Keeping it in
 * one place is what lets a candidate and a list entry fold to the same string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Applies NFKC, so a length is measured on the characters a person typed rather than on
 * whichever encoding their keyboard produced. Used for comparison and counting only.
 */
export function normalizePassword(candidate: string): string {
	return candidate.normalize("NFKC");
}

/**
 * Folds a value for a case-insensitive comparison: NFKC, then lowercase. The bundled
 * common-password list is stored already folded this way.
 */
export function foldPassword(value: string): string {
	return value.normalize("NFKC").toLowerCase();
}

/**
 * Counts Unicode code points, the unit NIST SP 800-63B measures length in, so a
 * surrogate pair such as an emoji counts once.
 */
export function countCodePoints(value: string): number {
	let pairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
	return value.length - (pairs?.length ?? 0);
}
