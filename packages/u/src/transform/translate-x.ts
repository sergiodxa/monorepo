/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { spacing } from "../internal/tokens";
import { transformFunction } from "../internal/transform";

/**
 * Translates the element along the inline axis using the spacing scale or a
 * raw CSS length. Composable with every other `transform/` utility —
 * combining `u.translateX()` with, say, `u.rotate()` on the same element
 * applies both instead of one overwriting the other.
 *
 * @example u.translateX(4)
 * @example css({ "--ui-translate-x": "calc(var(--ui-spacing, 0.25rem) * 4)", transform: "translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0)) ..." })
 */
export function translateX<Node extends Element = Element>(value: SpacingValue) {
	return transformFunction<Node>({ translateX: spacing(value) });
}
