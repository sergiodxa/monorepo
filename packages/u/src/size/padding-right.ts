/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.pi()`, `u.pis()`, `u.pie()`, ...), but a fixed-side docked panel (e.g.
 * a drawer/sheet pinned to a physical screen edge) that pads itself away
 * from a genuinely physical, fixed viewport side — often combined with a
 * safe-area-inset offset — needs the physical property itself. This utility
 * is a deliberate, narrow exception scoped to that one use case: it sets
 * `padding-right` directly. For the logical default, use `u.pie()`/`u.pi()`
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies the physical `padding-right` property. Prefer `u.pie()`/`u.pi()`
 * (logical padding-inline) unless the padding is genuinely tied to the
 * physical right side rather than the logical inline-start/end edge.
 *
 * @example u.paddingRight(4)
 * @example css({ paddingRight: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.paddingRight(u.calc(`1.5rem + ${u.env("safe-area-inset-right", "0px")}`))
 * @example css({ paddingRight: "calc(1.5rem + env(safe-area-inset-right, 0px))" })
 */
export function paddingRight<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingRight: spacing(value) }));
}
