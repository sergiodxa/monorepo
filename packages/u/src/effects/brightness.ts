/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter.js";

/**
 * Applies a `filter: brightness(...)`, scaling every pixel's lightness. Values
 * below `1` darken and above `1` brighten; `0` is solid black. Composes with
 * every other filter utility through the shared composite `filter`.
 *
 * @example u.brightness(1.1)
 * @example css({ "--ui-filter-brightness": "1.1", filter: "blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1)) ..." })
 */
export function brightness<Node extends Element = Element>(value: number | (string & {}) = 1.1) {
	return filterFunction<Node>({ brightness: String(value) });
}
