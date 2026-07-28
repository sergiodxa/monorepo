/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { resolveBox } from "../internal/box";
import { utility } from "../internal/descriptor";

/**
 * Applies logical `scroll-padding` on a scroll container, insetting the region
 * a snap position or an anchor jump is allowed to land in. Without it, a
 * sticky header sitting inside the container covers the top of whatever the
 * scroll just brought into view — the reader arrives at a heading that is
 * hidden behind the bar. Give the container scroll-padding equal to the
 * header's height and the landing point clears it.
 *
 * Follows the same 1/2/4-value logical mapping as `p()`: one value applies all
 * sides; two values map to block then inline; four values map to block-start,
 * inline-end, block-end, and inline-start — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.scrollPadding(4)
 * @example css({ scrollPadding: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.scrollPadding(16, 0)
 * @example css({ scrollPaddingBlock: "...", scrollPaddingInline: "..." })
 */
export function scrollPadding<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("scrollPadding", values));
}
