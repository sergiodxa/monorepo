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
 * resize handle along. Defaults to `"block"` — the shape a textarea almost
 * always wants (taller when the value outgrows the box, never wider than the
 * form column), expressed logically so it follows the writing mode.
 *
 * `"block"` and `"inline"` are the logical forms and the default, matching
 * every other logical utility in this package. `"horizontal"` and `"vertical"`
 * are the physical exception, worth reaching for only when the direction
 * genuinely must not flip with the writing mode — note they are the wider-
 * support pair, so a control that must resize on very old engines needs the
 * physical form explicitly.
 *
 * `resize` only applies to an element whose `overflow` is something other than
 * `visible`. That's why it works on a `<textarea>` with no extra setup — a
 * textarea is a scroll container already — but needs `u.overflow()` (or one of
 * its axis variants) alongside it to do anything on a plain `<div>`.
 *
 * `"none"` takes away an affordance the platform provided and a user may be
 * relying on: someone with a long answer to type, or a large font size, resizes
 * a textarea because the default box is too small for them. Removing it should
 * be a deliberate decision about a specific control, not a blanket reset.
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
