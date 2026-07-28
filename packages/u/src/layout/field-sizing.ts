/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Whether a form control sizes itself to its own value (`"content"`) or keeps
 * the fixed default size the platform gives it (`"fixed"`, the CSS default).
 */
export type FieldSizingValue = "content" | "fixed";

/**
 * Applies `field-sizing` to an `<input>`, `<textarea>`, or `<select>`.
 * Defaults to `"content"`, which makes the control size itself to the value
 * it currently holds instead of the fixed default width the platform picks —
 * the native answer to an auto-growing textarea or a select that hugs its
 * chosen option, replacing the JavaScript resize observer (or mirrored
 * hidden-element trick) that pattern used to require.
 *
 * Content sizing is unbounded on its own, so pair it with `u.maxBs()` to cap
 * how tall a textarea grows and `u.maxIs()` to cap how wide an input grows,
 * letting the control's own overflow take over past that point.
 *
 * Sits alongside `u.appearance()` as a form-control primitive: that one clears
 * the platform's native chrome, this one hands sizing over to the value.
 *
 * @example u.fieldSizing()
 * @example css({ fieldSizing: "content" })
 * @example u.fieldSizing("fixed")
 * @example css({ fieldSizing: "fixed" })
 */
export function fieldSizing<Node extends Element = Element>(value: FieldSizingValue = "content") {
	return utility<Node>(() => ({ fieldSizing: value }));
}
