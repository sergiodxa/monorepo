/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Whether a form control sizes itself to its own value (`"content"`) or keeps
 * the fixed default size the platform gives it (`"fixed"`, the CSS default).
 */
export type FieldSizingValue = "content" | "fixed";

/**
 * Applies `field-sizing` to an `<input>`, `<textarea>`, or `<select>`.
 * Defaults to `"content"`, sizing the control to the value it holds; cap that
 * growth with `u.maxBs()` or `u.maxIs()` so overflow takes over past the cap.
 *
 * @example u.fieldSizing()
 * @example css({ fieldSizing: "content" })
 * @example u.fieldSizing("fixed")
 * @example css({ fieldSizing: "fixed" })
 */
export function fieldSizing<Node extends Element = Element>(value: FieldSizingValue = "content") {
	return utility<Node>(() => ({ fieldSizing: value }));
}
