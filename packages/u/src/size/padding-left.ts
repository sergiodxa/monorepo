/**
 * `@pkg/u` is logical-property-first everywhere else in the `size/` family
 * (`u.pi()`, `u.pis()`, `u.pie()`, ...), but a fixed-side docked panel (e.g.
 * a drawer/sheet pinned to a physical screen edge) that pads itself away
 * from a genuinely physical, fixed viewport side — often combined with a
 * safe-area-inset offset — needs the physical property itself. This utility
 * is a deliberate, narrow exception scoped to that one use case: it sets
 * `padding-left` directly. For the logical default, use `u.pis()`/`u.pi()`
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies the physical `padding-left` property. Prefer `u.pis()`/`u.pi()`
 * (logical padding-inline) unless the padding is genuinely tied to the
 * physical left side rather than the logical inline-start/end edge.
 *
 * @example u.paddingLeft(4)
 * @example css({ paddingLeft: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.paddingLeft(u.calc(`1.5rem + ${u.env("safe-area-inset-left", "0px")}`))
 * @example css({ paddingLeft: "calc(1.5rem + env(safe-area-inset-left, 0px))" })
 */
export function paddingLeft<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingLeft: spacing(value) }));
}
