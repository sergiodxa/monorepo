/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { resolveBox } from "../internal/box";
import { utility } from "../internal/descriptor";

/**
 * Applies logical margin using the spacing scale, `"auto"`, or a raw CSS
 * length. Follows the same 1/2/4-value logical mapping as `p()` — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.m(4)
 * @example css({ margin: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.m(4, "auto")
 * @example css({ marginBlock: "...", marginInline: "auto" })
 */
export function m<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("margin", values));
}
