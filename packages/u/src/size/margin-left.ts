/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.mi()`, `u.mis()`, `u.mie()`, ...), but an anchor-positioned surface
 * (e.g. a popover) that offsets itself from a genuinely physical, fixed
 * viewport side — tied to which physical side of its anchor it popped out
 * on, not the logical writing direction — needs the physical property
 * itself. This utility is a deliberate, narrow exception scoped to that one
 * use case: it sets `margin-left` directly. For the logical default, use
 * `u.mi()` (`margin-inline`) instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies the physical `margin-left` property. Prefer `u.mi()`
 * (`margin-inline`) unless the offset is genuinely tied to the physical
 * left side rather than the logical inline-start/end edge.
 *
 * @example u.marginLeft(4)
 * @example css({ marginLeft: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function marginLeft<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginLeft: spacing(value) }));
}
