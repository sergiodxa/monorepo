/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { resolveBox } from "../internal/box";
import { utility } from "../internal/descriptor";

/**
 * Applies logical `scroll-margin` on a scroll item, growing the box the
 * container aligns when it snaps to this item or an anchor jump targets it.
 * It solves the sticky-header overlap from the item's side rather than the
 * container's: `scrollPadding()` insets every landing point at once, while
 * `scrollMargin()` offsets just the items that need the extra room.
 *
 * Follows the same 1/2/4-value logical mapping as `m()`: one value applies all
 * sides; two values map to block then inline; four values map to block-start,
 * inline-end, block-end, and inline-start — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.scrollMargin(4)
 * @example css({ scrollMargin: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.scrollMargin(16, 0)
 * @example css({ scrollMarginBlock: "...", scrollMarginInline: "..." })
 */
export function scrollMargin<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("scrollMargin", values));
}
