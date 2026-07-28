/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: grayscale(...)`, desaturating the element toward grey.
 * `1` (the default) is fully grey and `0` leaves it untouched — a way to dim
 * an inactive or unavailable element without changing its layout. Note it is
 * purely visual: it conveys nothing to assistive technology, so it must not be
 * the only signal that something is unavailable. Composes through the shared
 * composite `filter` declaration, so it combines with every other filter
 * utility instead of overwriting them.
 *
 * @example u.grayscale()
 * @example css({ "--ui-filter-grayscale": "1", filter: "... grayscale(var(--ui-filter-grayscale, 0)) ..." })
 */
export function grayscale<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return filterFunction<Node>({ grayscale: String(value) });
}
