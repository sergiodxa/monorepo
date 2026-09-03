/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type VisibilityValue = "visible" | "hidden" | "collapse";

/**
 * Controls the CSS `visibility` property: a `"hidden"` element keeps its
 * layout box and can transition back to `"visible"`, which is what a
 * selection indicator or hover-triggered surface needs to fade in place.
 *
 * @example u.visibility()
 * @example css({ visibility: "visible" })
 * @example u.visibility("hidden")
 * @example css({ visibility: "hidden" })
 */
export function visibility<Node extends Element = Element>(value: VisibilityValue = "visible") {
	return utility<Node>(() => ({ visibility: value }));
}
