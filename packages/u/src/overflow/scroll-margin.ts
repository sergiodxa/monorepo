/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { resolveBox } from "../internal/box";
import { utility } from "../internal/descriptor";

/**
 * Applies logical `scroll-margin` on a scroll item, growing the box the
 * container aligns when it snaps to this item or an anchor jump targets it, so
 * a sticky header clears only the items that need the extra room.
 *
 * @param values One value applies all sides; two map to block then inline;
 * four map to block-start, inline-end, block-end, inline-start.
 * @example u.scrollMargin(4)
 * @example css({ scrollMargin: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.scrollMargin(16, 0)
 * @example css({ scrollMarginBlock: "...", scrollMarginInline: "..." })
 * @see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
 */
export function scrollMargin<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("scrollMargin", values));
}
