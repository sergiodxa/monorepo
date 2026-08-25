/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Every standard CSS `cursor` keyword. Any other string still type-checks,
 * keeping a `url(...)` custom-image cursor available, optionally with a
 * trailing keyword fallback, e.g. `"url(cursor.png), pointer"`.
 */
export type CursorValue =
	| "auto"
	| "default"
	| "none"
	| "context-menu"
	| "help"
	| "pointer"
	| "progress"
	| "wait"
	| "cell"
	| "crosshair"
	| "text"
	| "vertical-text"
	| "alias"
	| "copy"
	| "move"
	| "no-drop"
	| "not-allowed"
	| "grab"
	| "grabbing"
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
	| "zoom-in"
	| "zoom-out";

/**
 * Applies `cursor`. Accepts any {@link CursorValue} keyword — `"pointer"` for
 * an interactive control, `"not-allowed"` for a disabled one, `"default"` to
 * force the plain arrow — or an arbitrary string for a `url(...)` cursor.
 *
 * @example u.cursor("pointer")
 * @example css({ cursor: "pointer" })
 * @example u.cursor("not-allowed")
 * @example css({ cursor: "not-allowed" })
 */
export function cursor<Node extends Element = Element>(value: CursorValue | (string & {})) {
	return utility<Node>(() => ({ cursor: value }));
}
