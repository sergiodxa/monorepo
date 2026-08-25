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
 * Sets the pivot point for every transform on the element. It's its own CSS
 * property, set outright rather than joining the additive `transform`
 * composition. Values are physical only — drive an RTL-flipping origin from a custom property.
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
