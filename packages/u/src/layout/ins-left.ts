/**
 * `@pkg/u` is logical-property-first for inset (`u.insBs()`, `u.insBe()`,
 * `u.insIs()`, `u.insIe()`), but an anchor-positioned surface (e.g. a
 * popover) that offsets itself from a genuinely physical, fixed viewport
 * side — tied to which physical side of its anchor it popped out on, not
 * the logical writing direction — needs the physical property itself. This
 * utility is a deliberate, narrow exception scoped to that one use case: it
 * sets `left` directly. For the logical default, use `u.insIs()`
 * (`inset-inline-start`) instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `left` property. Prefer `u.insIs()`
 * (`inset-inline-start`) unless the offset is genuinely tied to the physical
 * left side rather than the logical inline-start/end edge.
 *
 * @example u.insLeft(4)
 * @example css({ left: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insLeft<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ left: boxLength(value) }));
}
