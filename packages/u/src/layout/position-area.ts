/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the CSS Anchor Positioning `position-area` property, placing an
 * anchor-positioned element in a named region of the 3x3 grid around its
 * anchor. Accepts the whole logical-position-keyword grammar as a string.
 *
 * @example u.positionArea("top left")
 * @example css({ positionArea: "top left" })
 * @example u.positionArea("bottom span-right")
 * @example css({ positionArea: "bottom span-right" })
 */
export function positionArea<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ positionArea: value }));
}
