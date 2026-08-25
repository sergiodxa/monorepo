/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { OverflowValue } from "./overflow";

/**
 * Applies `overflow-inline`, independently of the block axis. The inline axis
 * follows writing mode and direction, so the utility stays correct under RTL
 * and vertical writing modes.
 *
 * @example u.overflowInline("auto")
 * @example css({ overflowInline: "auto" })
 */
export function overflowInline<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowInline: value }));
}
