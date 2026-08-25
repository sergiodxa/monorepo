/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `grid-auto-columns` to the *implicit* columns a grid creates past
 * its explicit tracks. A number resolves on the spacing scale, `"full"` to
 * `100%`; raw strings such as `minmax(...)` reach CSS verbatim.
 *
 * @example u.gridAutoColumns(40)
 * @example css({ gridAutoColumns: "calc(var(--ui-spacing, 0.25rem) * 40)" })
 * @example u.gridAutoColumns("minmax(10rem, 1fr)")
 * @example css({ gridAutoColumns: "minmax(10rem, 1fr)" })
 * @example u.gridAutoColumns("max-content")
 * @example css({ gridAutoColumns: "max-content" })
 */
export function gridAutoColumns<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ gridAutoColumns: boxLength(value) }));
}
