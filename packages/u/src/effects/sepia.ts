/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter";

/**
 * Applies a `filter: sepia(...)`, shifting the element toward a warm brown
 * monochrome; `1` (the default) is a full conversion. Writes into the shared
 * composite `filter` declaration, so it stacks with every other filter utility.
 *
 * @example u.sepia()
 * @example css({ "--ui-filter-sepia": "1", filter: "... sepia(var(--ui-filter-sepia, 0)) ..." })
 */
export function sepia<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return filterFunction<Node>({ sepia: String(value) });
}
