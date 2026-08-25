/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Which axes a user may resize the element along: neither (`"none"`), both, or
 * one — either logically (`"block"`, `"inline"`, which follow the writing
 * mode) or physically (`"horizontal"`, `"vertical"`, which don't).
 */
export type ResizeValue = "none" | "both" | "horizontal" | "vertical" | "block" | "inline";

/**
 * Applies `resize`, controlling which axes a user can drag the element's
 * resize handle along. Defaults to `"block"`, the shape most textareas want,
 * and only takes effect on an element whose `overflow` is not `visible`.
 *
 * @example u.resize()
 * @example css({ resize: "block" })
 * @example u.resize("vertical")
 * @example css({ resize: "vertical" })
 * @example u.resize("none")
 * @example css({ resize: "none" })
 */
export function resize<Node extends Element = Element>(value: ResizeValue = "block") {
	return utility<Node>(() => ({ resize: value }));
}
