/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ScaleValue } from "../internal/transform";

import { scaleFactor, transformFunction } from "../internal/transform";

/**
 * Scales the element along the vertical axis only. A bare number is a
 * unitless factor; a string passes through unchanged. Composable with
 * every other `transform/` utility.
 *
 * @example u.scaleY(1.5)
 * @example css({ "--ui-scale-y": "1.5", transform: "... scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1)) ..." })
 */
export function scaleY<Node extends Element = Element>(value: ScaleValue) {
	return transformFunction<Node>({ scaleY: scaleFactor(value) });
}
