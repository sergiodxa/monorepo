/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { OverflowValue } from "./overflow";

/**
 * Applies `overflow-inline`, independently of the block axis. Unlike
 * `u.overflowX()`, this follows the inline axis as defined by writing mode
 * and direction, so it stays correct under RTL and vertical writing modes.
 *
 * @example u.overflowInline("auto")
 * @example css({ overflowInline: "auto" })
 */
export function overflowInline<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowInline: value }));
}
