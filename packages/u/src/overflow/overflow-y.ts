/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { OverflowValue } from "./overflow";

/**
 * Applies `overflow-y`, independently of the inline axis.
 *
 * @example u.overflowY("auto")
 * @example css({ overflowY: "auto" })
 */
export function overflowY<Node extends Element = Element>(value: OverflowValue = "hidden") {
	return utility<Node>(() => ({ overflowY: value }));
}
