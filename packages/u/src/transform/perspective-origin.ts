/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { TransformOriginValue } from "./transform-origin";

/**
 * Moves the vanishing point that `u.perspective()` establishes, aiming the
 * 3D effect off-centre; set it on the same parent element that carries
 * `u.perspective()`.
 *
 * @see u.transformOrigin() for the accepted values, including the
 * raw-string escape for lengths and percentages.
 * @see Sets `perspective-origin` directly as its own CSS property,
 * composing independently of the `transform` function utilities.
 * @example u.perspectiveOrigin()
 * @example css({ perspectiveOrigin: "center" })
 * @example u.perspectiveOrigin("top left")
 * @example css({ perspectiveOrigin: "top left" })
 * @example u.perspectiveOrigin("25% 75%")
 * @example css({ perspectiveOrigin: "25% 75%" })
 */
export function perspectiveOrigin<Node extends Element = Element>(
	value: TransformOriginValue = "center",
) {
	return utility<Node>(() => ({ perspectiveOrigin: value }));
}
