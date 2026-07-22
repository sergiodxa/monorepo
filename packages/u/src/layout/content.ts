/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { JustifyValue } from "./justify";

import { resolveJustify } from "./justify";

/**
 * Sets `align-content`, using the same accepted keywords and
 * `between`/`around`/`evenly` aliasing as `u.justify()`.
 *
 * @example u.content("between")
 * @example css({ alignContent: "space-between" })
 */
export function content<Node extends Element = Element>(value: JustifyValue = "start") {
	return utility<Node>(() => ({ alignContent: resolveJustify(value) }));
}
