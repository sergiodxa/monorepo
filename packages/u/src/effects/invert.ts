/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: invert(...)`, inverting the element's colors. `1` (the
 * default) is a full inversion and `0` leaves it untouched. Most often used to
 * flip a single-color raster asset — a black PNG logo or icon sprite — for
 * dark mode, where an SVG would instead be painted through `u.fill()`.
 * Composes through the shared composite `filter` declaration, so it combines
 * with every other filter utility instead of overwriting them.
 *
 * @example u.invert()
 * @example css({ "--ui-filter-invert": "1", filter: "... invert(var(--ui-filter-invert, 0)) ..." })
 */
export function invert<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return filterFunction<Node>({ invert: String(value) });
}
