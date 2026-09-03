/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform.js";

import { angle, transformFunction } from "../internal/transform.js";

/**
 * Skews the element along the vertical axis. A bare number is treated as
 * degrees; a string passes through unchanged. Composable with every other
 * `transform/` utility.
 *
 * @example u.skewY(10)
 * @example css({ "--ui-skew-y": "10deg", transform: "... skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg))" })
 */
export function skewY<Node extends Element = Element>(value: AngleValue) {
	return transformFunction<Node>({ skewY: angle(value) });
}
