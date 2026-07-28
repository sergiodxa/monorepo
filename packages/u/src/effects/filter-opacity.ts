/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: opacity(...)`, the filter-function form of transparency.
 * Named `filterOpacity` rather than `opacity` because `u.opacity()` already
 * exists in this family and sets the plain `opacity` *property* — two
 * different things that happen to share a name in CSS.
 *
 * The distinction is subtle and matters:
 *
 * - `u.opacity()` sets the `opacity` property, which flattens the element
 *   *and all of its descendants* into one group and fades that group as a
 *   whole. It also creates a stacking context.
 * - `filterOpacity()` adds an `opacity()` function to the element's `filter`
 *   list, so it runs inside the filter pipeline: it composes with the other
 *   filter functions in the same declaration (a `blur()` or `grayscale()`
 *   applied by another utility), and it is applied at a different stage of
 *   rendering than the property — which is why the two can produce visibly
 *   different results on the same element, and why stacking a filter chain
 *   plus a fade in one pass is the case this utility is for.
 *
 * Footgun: this takes CSS's native `0`–`1` range (or a percentage string),
 * **not** the `0`–`100` integer convention `u.opacity()` uses. `u.opacity(50)`
 * and `u.filterOpacity(0.5)` are the same amount of fade; `filterOpacity(50)`
 * is not — it clamps to fully opaque.
 *
 * Composes through the shared composite `filter` declaration, so it combines
 * with every other filter utility instead of overwriting them.
 *
 * @example u.filterOpacity()
 * @example css({ "--ui-filter-opacity": "0.5", filter: "... opacity(var(--ui-filter-opacity, 1)) ..." })
 * @example u.filterOpacity("25%")
 * @example css({ "--ui-filter-opacity": "25%", filter: "... opacity(var(--ui-filter-opacity, 1)) ..." })
 */
export function filterOpacity<Node extends Element = Element>(value: number | (string & {}) = 0.5) {
	return filterFunction<Node>({ opacity: String(value) });
}
