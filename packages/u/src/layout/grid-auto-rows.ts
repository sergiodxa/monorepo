/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies `grid-auto-rows` to the *implicit* rows a grid creates past its
 * explicit tracks. A number resolves on the spacing scale, `"full"` to
 * `100%`; raw strings such as `minmax(...)` reach CSS verbatim.
 *
 * @example u.gridAutoRows(24)
 * @example css({ gridAutoRows: "calc(var(--ui-spacing, 0.25rem) * 24)" })
 * @example u.gridAutoRows("minmax(6rem, auto)")
 * @example css({ gridAutoRows: "minmax(6rem, auto)" })
 * @example u.gridAutoRows("min-content")
 * @example css({ gridAutoRows: "min-content" })
 */
export function gridAutoRows<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ gridAutoRows: boxLength(value) }));
}
