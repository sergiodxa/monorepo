/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: saturate(...)`, scaling color intensity. `0` is fully
 * desaturated and values above `1` oversaturate. This is the `filter`
 * counterpart to `u.backdropSaturate()`, which saturates what shows *through*
 * an element rather than the element itself. Composes through the shared
 * composite `filter` declaration, so it combines with every other filter
 * utility instead of overwriting them.
 *
 * @example u.saturate(1.5)
 * @example css({ "--ui-filter-saturate": "1.5", filter: "... saturate(var(--ui-filter-saturate, 1)) ..." })
 */
export function saturate<Node extends Element = Element>(value: number | (string & {}) = 1.5) {
	return filterFunction<Node>({ saturate: String(value) });
}
