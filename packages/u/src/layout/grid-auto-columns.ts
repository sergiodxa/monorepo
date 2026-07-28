/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `grid-auto-columns`, sizing the *implicit* columns a grid creates
 * for content that runs past the explicit tracks `u.gridTemplate()` declared.
 * It has no effect on those explicit tracks — it only answers "how wide is
 * column four when I only declared three?".
 *
 * A number resolves against the spacing scale and `"full"` resolves to
 * `100%`, the same as `u.is()` and friends. The values implicit tracks most
 * often want — `"auto"`, `"min-content"`, `"max-content"`, or a
 * `minmax(...)` clause — aren't lengths on a scale, so they go through the
 * raw-string escape and pass straight to CSS.
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
