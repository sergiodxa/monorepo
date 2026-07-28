/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type ObjectPositionValue =
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
 * Applies `object-position`, which decides which part of a replaced element's
 * content survives the crop `u.fit("cover")` performs — so it is what keeps a
 * subject's face in frame when a portrait photo is squeezed into a wide
 * thumbnail, instead of framing the middle of the image and cutting the head
 * off.
 *
 * It does nothing on its own: without `u.fit()` establishing a crop there is
 * no overflow to position, and it has no effect at all on non-replaced
 * elements (a `div` ignores it).
 *
 * The keywords are physical, not logical — `left` and `right` stay put under a
 * right-to-left writing mode.
 *
 * @example u.objectPosition()
 * @example css({ objectPosition: "center" })
 * @example u.objectPosition("top")
 * @example css({ objectPosition: "top" })
 * @example u.objectPosition("50% 20%")
 * @example css({ objectPosition: "50% 20%" })
 */
export function objectPosition<Node extends Element = Element>(
	value: ObjectPositionValue = "center",
) {
	return utility<Node>(() => ({ objectPosition: value }));
}
