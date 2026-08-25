/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { boxShadowSlot } from "../internal/box-shadow";
import { color } from "../internal/tokens";

/**
 * Draws a selection ring that stays visible for as long as a component applies
 * it, for persistently-selected swatches, chips, and thumbnails. Occupies the
 * composite `boxShadow` `ring` slot, painting inside `u.shadow()`'s elevation.
 *
 * @example u.ringShadow("brand")
 * @example css({ "--ui-box-shadow-ring": "0 0 0 2px var(--ui-brand-bg-solid)", boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)" })
 * @example u.ringShadow("danger", 3)
 * @example css({ "--ui-box-shadow-ring": "0 0 0 3px var(--ui-danger-bg-solid)", boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)" })
 */
export function ringShadow<Node extends Element = Element>(
	value: ColorValue | (string & {}),
	width: number | (string & {}) = 2,
) {
	let resolvedWidth = typeof width === "number" ? `${width}px` : width;
	return boxShadowSlot<Node>({ ring: `0 0 0 ${resolvedWidth} ${color(value, "bg-solid")}` });
}
