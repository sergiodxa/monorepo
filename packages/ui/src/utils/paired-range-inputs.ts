/**
 * Shared query for a pair of `<input type="range">` elements living under a
 * host element, told apart by a single `data-*` attribute carrying a
 * different value on each half — a horizontal/vertical axis pair, a
 * lower/upper-bound thumb, or any other paired arrangement a mixin
 * coordinates through the same attribute-and-value convention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Finds the pair of `<input type="range">` elements under `host` carrying
 * `attribute` set to `valueA` and `valueB` respectively.
 *
 * @param host Element the paired range inputs render inside.
 * @param attribute `data-*` attribute name distinguishing the two inputs from each other.
 * @param valueA `attribute` value identifying the first input of the pair.
 * @param valueB `attribute` value identifying the second input of the pair.
 * @returns The matched pair, keyed `a` and `b` in the same order as `valueA` and `valueB`, or `null` when either input is missing.
 * @example
 * findPairedRangeInputs(host, "data-thumb", "min", "max");
 */
export function findPairedRangeInputs(
	host: HTMLElement,
	attribute: string,
	valueA: string,
	valueB: string,
): { a: HTMLInputElement; b: HTMLInputElement } | null {
	let a = host.querySelector<HTMLInputElement>(`input[type="range"][${attribute}="${valueA}"]`);
	let b = host.querySelector<HTMLInputElement>(`input[type="range"][${attribute}="${valueB}"]`);

	if (!a || !b) return null;
	return { a, b };
}
