/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies `grid-auto-rows`, sizing the *implicit* rows a grid creates for
 * content that runs past the explicit tracks `u.gridTemplate()` declared. It
 * has no effect on those explicit tracks — it only answers "how tall is row
 * six when I only declared five?".
 *
 * A number resolves against the spacing scale and `"full"` resolves to
 * `100%`, the same as `u.bs()` and friends. The values implicit tracks most
 * often want — `"auto"`, `"min-content"`, `"max-content"`, or a
 * `minmax(...)` clause — aren't lengths on a scale, so they go through the
 * raw-string escape and pass straight to CSS.
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
