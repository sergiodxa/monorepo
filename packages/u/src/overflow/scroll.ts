/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if";
import { compose } from "../internal/descriptor";

import { overflowX } from "./overflow-x";
import { overflowY } from "./overflow-y";

export type ScrollAxis = "x" | "y" | "both";

/**
 * Turns the element into a scroll container that only scrolls where content
 * overflows, along the given axis, rather than always showing scrollbars.
 * Defaults to `"both"`. Composes `u.overflowX("auto")`/`u.overflowY("auto")`
 * for whichever axis is selected.
 *
 * @example u.scroll()
 * @example css({ overflowX: "auto", overflowY: "auto" })
 * @example u.scroll("y")
 * @example css({ overflowY: "auto" })
 */
export function scroll<Node extends Element = Element>(axis: ScrollAxis = "both") {
	return compose<Node>(
		[
			ifUtility(axis === "x" || axis === "both", overflowX<Node>("auto")),
			ifUtility(axis === "y" || axis === "both", overflowY<Node>("auto")),
		],
		(styles) => styles,
	);
}
