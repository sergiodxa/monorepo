/**
 * Physical `bottom` inset, scoped to anchor-positioned surfaces such as a
 * popover, whose offset follows the physical viewport side its anchor popped
 * out on. Logical insets (`u.insBs()`, `u.insBe()`) cover every other case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies the physical `bottom` property. Reach for it when the offset is
 * genuinely tied to the physical bottom side; `u.insBe()`
 * (`inset-block-end`) covers the logical block edge.
 *
 * @example u.insBottom(4)
 * @example css({ bottom: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insBottom<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ bottom: boxLength(value) }));
}
