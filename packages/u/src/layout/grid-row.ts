/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { GridLineValue } from "./grid-column";

/**
 * Applies `grid-row`, placing or spanning a grid item along the block axis. A
 * number is a line number: `u.gridRow(2)` starts the item at the second row
 * line and occupies one track, while `u.gridRow("span 2")` occupies two.
 *
 * @example u.gridRow(2)
 * @example css({ gridRow: 2 })
 * @example u.gridRow("span 3")
 * @example css({ gridRow: "span 3" })
 * @example u.gridRow("1 / -1")
 * @example css({ gridRow: "1 / -1" })
 * @example u.gridRow("header-start / header-end")
 * @example css({ gridRow: "header-start / header-end" })
 */
export function gridRow<Node extends Element = Element>(value: GridLineValue) {
	return utility<Node>(() => ({ gridRow: value }));
}
