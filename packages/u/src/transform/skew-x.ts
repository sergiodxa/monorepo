/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { angle, transformFunction } from "../internal/transform";

/**
 * Skews the element along the horizontal axis. A bare number is treated as
 * degrees; a string passes through unchanged. Composable with every other
 * `transform/` utility.
 *
 * @example u.skewX(10)
 * @example css({ "--ui-skew-x": "10deg", transform: "... skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg))" })
 */
export function skewX<Node extends Element = Element>(value: AngleValue) {
	return transformFunction<Node>({ skewX: angle(value) });
}
