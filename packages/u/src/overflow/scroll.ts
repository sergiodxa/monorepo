/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if.js";
import { compose } from "../internal/descriptor.js";

import { overflowX } from "./overflow-x.js";
import { overflowY } from "./overflow-y.js";

export type ScrollAxis = "x" | "y" | "both";

/**
 * Turns the element into a scroll container that reveals a scrollbar only
 * where content actually overflows the given axis, defaulting to `"both"`.
 * Composes `u.overflowX("auto")`/`u.overflowY("auto")` for the selected axis.
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
