/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter.js";

/**
 * Inverts colors (`1`, the default, fully) to flip single-color raster assets
 * for dark mode. Composes through the shared composite `filter` declaration,
 * so it combines with every other filter utility.
 *
 * @example u.invert()
 * @example css({ "--ui-filter-invert": "1", filter: "... invert(var(--ui-filter-invert, 0)) ..." })
 */
export function invert<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return filterFunction<Node>({ invert: String(value) });
}
