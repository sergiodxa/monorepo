/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter.js";

/**
 * Applies a `filter: contrast(...)`, pushing pixels away from (above `1`) or
 * toward (below `1`) mid-grey; `0` flattens the element to uniform grey.
 * Composes with every other filter utility through the shared composite filter.
 *
 * @example u.contrast(1.25)
 * @example css({ "--ui-filter-contrast": "1.25", filter: "... contrast(var(--ui-filter-contrast, 1)) ..." })
 */
export function contrast<Node extends Element = Element>(value: number | (string & {}) = 1.25) {
	return filterFunction<Node>({ contrast: String(value) });
}
