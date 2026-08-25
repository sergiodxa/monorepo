/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: opacity(...)`, fading the element inside the filter
 * pipeline so one pass carries the fade along with any `blur()` or
 * `grayscale()`. Takes CSS's native `0`–`1` range, or a percentage string.
 *
 * @example u.filterOpacity()
 * @example css({ "--ui-filter-opacity": "0.5", filter: "... opacity(var(--ui-filter-opacity, 1)) ..." })
 * @example u.filterOpacity("25%")
 * @example css({ "--ui-filter-opacity": "25%", filter: "... opacity(var(--ui-filter-opacity, 1)) ..." })
 */
export function filterOpacity<Node extends Element = Element>(value: number | (string & {}) = 0.5) {
	return filterFunction<Node>({ opacity: String(value) });
}
