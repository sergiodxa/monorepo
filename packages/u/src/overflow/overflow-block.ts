/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

import type { OverflowValue } from "./overflow.js";

/**
 * Applies `overflow-block`, independently of the inline axis. The block axis
 * follows writing mode and direction, so the utility stays correct under RTL
 * and vertical writing modes.
 *
 * @example u.overflowBlock("auto")
 * @example css({ overflowBlock: "auto" })
 */
export function overflowBlock<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowBlock: value }));
}
