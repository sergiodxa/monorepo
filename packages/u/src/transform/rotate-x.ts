/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { angle, transformFunction } from "../internal/transform";

/**
 * Rotates the element in 3D around its horizontal axis — a flip-card or
 * page-turn effect. Pair with `u.backfaceVisibility()` so the reversed face
 * doesn't show through mid-rotation. Composable with every other
 * `transform/` utility.
 *
 * @example u.rotateX(180)
 * @example css({ "--ui-rotate-x": "180deg", transform: "... rotateX(var(--ui-rotate-x, 0deg)) ..." })
 */
export function rotateX<Node extends Element = Element>(value: AngleValue) {
	return transformFunction<Node>({ rotateX: angle(value) });
}
