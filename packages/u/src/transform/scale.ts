/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ScaleValue } from "../internal/transform.js";

import { scaleFactor, transformFunction } from "../internal/transform.js";

/**
 * Scales the element uniformly on both axes — sugar for setting `u.scaleX()`
 * and `u.scaleY()` to the same factor in one call. Composable with every
 * other `transform/` utility.
 *
 * @example u.scale(1.5)
 * @example css({ "--ui-scale-x": "1.5", "--ui-scale-y": "1.5", transform: "..." })
 */
export function scale<Node extends Element = Element>(value: ScaleValue) {
	let factor = scaleFactor(value);
	return transformFunction<Node>({ scaleX: factor, scaleY: factor });
}
