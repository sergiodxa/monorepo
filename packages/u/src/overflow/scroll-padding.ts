/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveBox } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies logical `scroll-padding` so a scroll snap position or anchor jump
 * lands clear of a sticky header — set it to the header's height. Follows
 * `p()`'s 1/2/4-value logical mapping; see [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.scrollPadding(4)
 * @example css({ scrollPadding: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.scrollPadding(16, 0)
 * @example css({ scrollPaddingBlock: "...", scrollPaddingInline: "..." })
 */
export function scrollPadding<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("scrollPadding", values));
}
