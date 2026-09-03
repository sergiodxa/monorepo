/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { resolveBox } from "../internal/box.js";
import { utility } from "../internal/descriptor.js";

/**
 * Applies logical padding using the spacing scale or a raw CSS length. One
 * value applies all sides; two values map to block then inline; four values
 * map to block-start, inline-end, block-end, and inline-start.
 *
 * @see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
 * @example u.p(4)
 * @example css({ padding: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.p(1, 2, 3, 4)
 * @example css({ paddingBlockStart: "...", paddingInlineEnd: "...", paddingBlockEnd: "...", paddingInlineStart: "..." })
 */
export function p<Node extends Element = Element>(...values: SpacingValue[]) {
	return utility<Node>(() => resolveBox("padding", values));
}
