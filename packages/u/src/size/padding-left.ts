/**
 * `@pkg/u` is logical-property-first elsewhere in `size/`, but a docked
 * panel pinned to a physical, fixed viewport edge — often with a
 * safe-area-inset offset — needs the physical property itself. This
 * utility is that narrow exception: it sets `padding-left` directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies the physical `padding-left` property, for padding pinned to a
 * fixed, physical viewport edge — such as a safe-area-inset offset on a
 * docked panel. Prefer `u.pis()`/`u.pi()` for logical inline padding.
 *
 * @example u.paddingLeft(4)
 * @example css({ paddingLeft: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.paddingLeft(u.calc(`1.5rem + ${u.env("safe-area-inset-left", "0px")}`))
 * @example css({ paddingLeft: "calc(1.5rem + env(safe-area-inset-left, 0px))" })
 */
export function paddingLeft<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingLeft: spacing(value) }));
}
