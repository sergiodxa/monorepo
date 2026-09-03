/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter.js";

/**
 * Applies a `filter: saturate(...)` to the element itself, where `0` is fully
 * desaturated and values above `1` oversaturate. Writes into the shared
 * composite `filter` declaration, so it stacks with every other filter utility.
 *
 * @example u.saturate(1.5)
 * @example css({ "--ui-filter-saturate": "1.5", filter: "... saturate(var(--ui-filter-saturate, 1)) ..." })
 */
export function saturate<Node extends Element = Element>(value: number | (string & {}) = 1.5) {
	return filterFunction<Node>({ saturate: String(value) });
}
