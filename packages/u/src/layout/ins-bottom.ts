/**
 * `@pkg/u` is logical-property-first for inset (`u.insBs()`, `u.insBe()`,
 * `u.insIs()`, `u.insIe()`), but an anchor-positioned surface (e.g. a
 * popover) that offsets itself from a genuinely physical, fixed viewport
 * side — tied to which physical side of its anchor it popped out on, not
 * the logical writing direction — needs the physical property itself. This
 * utility is a deliberate, narrow exception scoped to that one use case: it
 * sets `bottom` directly. For the logical default, use `u.insBe()`
 * (`inset-block-end`) instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `bottom` property. Prefer `u.insBe()`
 * (`inset-block-end`) unless the offset is genuinely tied to the physical
 * bottom side rather than the logical block-start/end edge.
 *
 * @example u.insBottom(4)
 * @example css({ bottom: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insBottom<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ bottom: boxLength(value) }));
}
