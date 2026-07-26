/**
 * `@pkg/u` is logical-property-first for inset (`u.insBs()`, `u.insBe()`,
 * `u.insIs()`, `u.insIe()`), but an anchor-positioned surface (e.g. a
 * popover) that offsets itself from a genuinely physical, fixed viewport
 * side — tied to which physical side of its anchor it popped out on, not
 * the logical writing direction — needs the physical property itself. This
 * utility is a deliberate, narrow exception scoped to that one use case: it
 * sets `right` directly. For the logical default, use `u.insIe()`
 * (`inset-inline-end`) instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `right` property. Prefer `u.insIe()`
 * (`inset-inline-end`) unless the offset is genuinely tied to the physical
 * right side rather than the logical inline-start/end edge.
 *
 * @example u.insRight(4)
 * @example css({ right: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insRight<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ right: boxLength(value) }));
}
