/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ScaleValue } from "../internal/transform.js";

import { scaleFactor, transformFunction } from "../internal/transform.js";

/**
 * Scales the element along the horizontal axis only. A bare number is a
 * unitless factor (`1` is unchanged, `1.5` is 150%); a string passes
 * through unchanged. Composable with every other `transform/` utility.
 *
 * @example u.scaleX(1.5)
 * @example css({ "--ui-scale-x": "1.5", transform: "... scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1)) ..." })
 */
export function scaleX<Node extends Element = Element>(value: ScaleValue) {
	return transformFunction<Node>({ scaleX: scaleFactor(value) });
}
