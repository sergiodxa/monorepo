/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The accepted `transform-origin` values: the common one- and two-keyword
 * forms, plus a raw-string escape covering lengths, percentages, and the
 * three-value 3D form (`"50% 50% 8px"`).
 */
export type TransformOriginValue =
	| "center"
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "top left"
	| "top right"
	| "bottom left"
	| "bottom right"
	| (string & {});

/**
 * Sets the point every transform on the element pivots around. This is what
 * makes `u.scaleX()` grow a progress bar from its leading edge instead of
 * from its middle, and what makes a menu scale open from the corner it's
 * anchored to instead of from its centre.
 *
 * `transform-origin` is its own CSS property rather than a transform
 * function, so it's set outright and never joins the additive `transform`
 * composition the `transform/` function utilities share.
 *
 * The values are physical, not logical — CSS has no logical
 * `transform-origin` — so an origin that has to flip under RTL can't be
 * expressed here directly; drive it from a custom property instead and pass
 * that through the raw-string escape.
 *
 * @example u.transformOrigin()
 * @example css({ transformOrigin: "center" })
 * @example u.transformOrigin("left")
 * @example css({ transformOrigin: "left" })
 * @example u.transformOrigin("bottom right")
 * @example css({ transformOrigin: "bottom right" })
 * @example u.transformOrigin("50% 50% 8px")
 * @example css({ transformOrigin: "50% 50% 8px" })
 */
export function transformOrigin<Node extends Element = Element>(
	value: TransformOriginValue = "center",
) {
	return utility<Node>(() => ({ transformOrigin: value }));
}
