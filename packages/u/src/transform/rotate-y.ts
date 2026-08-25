/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { angle, transformFunction } from "../internal/transform";

/**
 * Rotates the element in 3D around its vertical axis — a flip-card or
 * page-turn effect. Pair with `u.backfaceVisibility()` to hide the reversed
 * face mid-rotation. Composable with every other `transform/` utility.
 *
 * @example u.rotateY(180)
 * @example css({ "--ui-rotate-y": "180deg", transform: "... rotateY(var(--ui-rotate-y, 0deg)) ..." })
 */
export function rotateY<Node extends Element = Element>(value: AngleValue) {
	return transformFunction<Node>({ rotateY: angle(value) });
}
