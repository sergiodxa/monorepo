/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type VisibilityValue = "visible" | "hidden" | "collapse";

/**
 * Controls the CSS `visibility` property — unlike `display`, a `"hidden"`
 * element still takes up layout space and can be smoothly `transition`ed
 * back to `"visible"`, which is what a selection indicator or a
 * hover-triggered surface needs so its box stays in the flow while it fades
 * in and out.
 *
 * @example u.visibility()
 * @example css({ visibility: "visible" })
 * @example u.visibility("hidden")
 * @example css({ visibility: "hidden" })
 */
export function visibility<Node extends Element = Element>(value: VisibilityValue = "visible") {
	return utility<Node>(() => ({ visibility: value }));
}
