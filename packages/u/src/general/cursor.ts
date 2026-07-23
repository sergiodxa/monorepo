/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Every standard CSS `cursor` keyword, grouped the way the spec does. Any
 * other string still type-checks — a `url(...)` custom-image cursor (with an
 * optional trailing keyword fallback, e.g. `"url(cursor.png), pointer"`)
 * isn't a fixed keyword, so it can't be enumerated here.
 */
export type CursorValue =
	// General
	| "auto"
	| "default"
	| "none"
	// Links & status
	| "context-menu"
	| "help"
	| "pointer"
	| "progress"
	| "wait"
	// Selection
	| "cell"
	| "crosshair"
	| "text"
	| "vertical-text"
	// Drag & drop
	| "alias"
	| "copy"
	| "move"
	| "no-drop"
	| "not-allowed"
	| "grab"
	| "grabbing"
	// Resizing & scrolling
	| "all-scroll"
	| "col-resize"
	| "row-resize"
	| "n-resize"
	| "e-resize"
	| "s-resize"
	| "w-resize"
	| "ne-resize"
	| "nw-resize"
	| "se-resize"
	| "sw-resize"
	| "ew-resize"
	| "ns-resize"
	| "nesw-resize"
	| "nwse-resize"
	// Zooming
	| "zoom-in"
	| "zoom-out";

/**
 * Applies `cursor`. Accepts any {@link CursorValue} keyword — most commonly
 * `"pointer"` for an interactive control, `"not-allowed"` for a disabled
 * one, and `"default"` to opt a host back out of the platform's own
 * pointer-affordance guess — or an arbitrary string for a `url(...)`
 * custom-image cursor.
 *
 * @example u.cursor("pointer")
 * @example css({ cursor: "pointer" })
 * @example u.cursor("not-allowed")
 * @example css({ cursor: "not-allowed" })
 */
export function cursor<Node extends Element = Element>(value: CursorValue | (string & {})) {
	return utility<Node>(() => ({ cursor: value }));
}
