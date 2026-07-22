/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { angle, transformFunction } from "../internal/transform";

/**
 * Rotates the element in its own 2D plane. A bare number is treated as
 * degrees; a string passes through unchanged (e.g. `"0.25turn"`).
 * Composable with every other `transform/` utility.
 *
 * @example u.rotate(45)
 * @example css({ "--ui-rotate": "45deg", transform: "... rotate(var(--ui-rotate, 0deg)) ..." })
 */
export function rotate<Node extends Element = Element>(value: AngleValue) {
	return transformFunction<Node>({ rotate: angle(value) });
}
