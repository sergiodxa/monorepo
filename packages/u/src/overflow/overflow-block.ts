/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { OverflowValue } from "./overflow";

/**
 * Applies `overflow-block`, independently of the inline axis. Unlike
 * `u.overflowY()`, this follows the block axis as defined by writing mode
 * and direction, so it stays correct under RTL and vertical writing modes.
 *
 * @example u.overflowBlock("auto")
 * @example css({ overflowBlock: "auto" })
 */
export function overflowBlock<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowBlock: value }));
}
