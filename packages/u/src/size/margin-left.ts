/**
 * The `size/` utilities default to logical properties (`u.mi()`, `u.mis()`,
 * `u.mie()`, ...) so margins follow the writing direction. This one instead
 * pins to the physical left edge, for cases like an anchor-positioned
 * popover offsetting from the fixed viewport side it popped out on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Sets the physical `margin-left` property directly, pinned to the fixed
 * left edge regardless of writing direction. Prefer `u.mi()`
 * (`margin-inline`) for direction-aware margins.
 *
 * @example u.marginLeft(4)
 * @example css({ marginLeft: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function marginLeft<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginLeft: spacing(value) }));
}
