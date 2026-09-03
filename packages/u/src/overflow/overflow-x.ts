/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

import type { OverflowValue } from "./overflow.js";

/**
 * Applies `overflow-x`, independently of the block axis.
 *
 * @example u.overflowX("auto")
 * @example css({ overflowX: "auto" })
 */
export function overflowX<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowX: value }));
}
