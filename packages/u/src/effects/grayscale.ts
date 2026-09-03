/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { filterFunction } from "../internal/filter.js";

/**
 * Applies a `filter: grayscale(...)`, desaturating toward grey; `1` (the
 * default) is fully grey, dimming an inactive element while its layout holds.
 * Purely visual, so pair it with a cue assistive technology can read.
 *
 * @example u.grayscale()
 * @example css({ "--ui-filter-grayscale": "1", filter: "... grayscale(var(--ui-filter-grayscale, 0)) ..." })
 */
export function grayscale<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return filterFunction<Node>({ grayscale: String(value) });
}
