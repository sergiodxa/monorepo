/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";
import { supports } from "../responsive/supports";

export type CornerShape = "squircle" | "bevel" | "notch";

/**
 * The primitive `corner-shape` utility. Composes `u.supports()` so the
 * declaration only applies behind `@supports`, keeping an unsupported
 * browser on its normal `border-radius` shape instead of getting no corner
 * treatment at all.
 *
 * @example u.corner("squircle")
 * @example css({ "@supports (corner-shape: squircle)": { cornerShape: "squircle" } })
 */
export function corner<Node extends Element = Element>(shape: CornerShape) {
	return supports<Node>(
		`(corner-shape: ${shape})`,
		utility<Node>(() => ({ cornerShape: shape })),
	);
}
