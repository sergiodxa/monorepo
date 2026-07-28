/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { TransformOriginValue } from "./transform-origin";

/**
 * Moves the vanishing point that `u.perspective()` establishes, so the 3D
 * effect can be aimed off-centre — children lean away from wherever the
 * viewer is placed rather than always from the middle of the parent. Set it
 * on the same **parent** element that carries `u.perspective()`.
 *
 * Takes the same values as `u.transformOrigin()`, including the raw-string
 * escape for lengths and percentages.
 *
 * `perspective-origin` is its own CSS property rather than a transform
 * function, so it's set outright and never joins the additive `transform`
 * composition the `transform/` function utilities share.
 *
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
