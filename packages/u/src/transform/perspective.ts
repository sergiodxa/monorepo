/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets how far the viewer is from the z=0 plane, giving 3D-transformed
 * children a vanishing point. A smaller value puts the viewer closer and so
 * exaggerates the perspective; a larger value flattens it. Without it a 3D
 * rotation has no vanishing point at all and reads as a flat scale rather
 * than as depth.
 *
 * It belongs on the **parent** of the 3D-transformed children, alongside
 * `u.transformStyle()`.
 *
 * A bare number is treated as pixels; a string passes through unchanged,
 * including the `"none"` keyword, which removes the perspective entirely.
 *
 * `perspective` is its own CSS property rather than a transform function, so
 * it's set outright and never joins the additive `transform` composition the
 * `transform/` function utilities share.
 *
 * @example u.perspective()
 * @example css({ perspective: "800px" })
 * @example u.perspective(400)
 * @example css({ perspective: "400px" })
 * @example u.perspective("none")
 * @example css({ perspective: "none" })
 * @example u.perspective("50rem")
 * @example css({ perspective: "50rem" })
 */
export function perspective<Node extends Element = Element>(value: number | (string & {}) = 800) {
	return utility<Node>(() => ({
		perspective: typeof value === "number" ? `${value}px` : value,
	}));
}
