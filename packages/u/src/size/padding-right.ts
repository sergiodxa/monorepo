/**
 * `@sdxc/u` is logical-property-first elsewhere in `size/`, but a docked
 * panel pinned to a physical, fixed viewport edge — often with a
 * safe-area-inset offset — needs the physical property itself. This
 * utility is that narrow exception: it sets `padding-right` directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies the physical `padding-right` property, for padding pinned to a
 * fixed, physical viewport edge — such as a safe-area-inset offset on a
 * docked panel. Prefer `u.pie()`/`u.pi()` for logical inline padding.
 *
 * @example u.paddingRight(4)
 * @example css({ paddingRight: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.paddingRight(u.calc(`1.5rem + ${u.env("safe-area-inset-right", "0px")}`))
 * @example css({ paddingRight: "calc(1.5rem + env(safe-area-inset-right, 0px))" })
 */
export function paddingRight<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingRight: spacing(value) }));
}
