/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets how far the viewer is from the z=0 plane; without it, 3D rotation
 * reads as a flat scale, not depth. Goes on the **parent**, alongside
 * `u.transformStyle()`, as its own CSS property outside the composed `transform`.
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
