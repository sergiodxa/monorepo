/**
 * Physical `left` for an anchor-positioned surface whose offset follows the
 * fixed viewport side its anchor popped out on; inset otherwise stays
 * logical-property-first through `u.insIs()` and its siblings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `left` property, for offsets genuinely tied to the
 * viewport's left side. `u.insIs()` (`inset-inline-start`) covers the
 * writing-direction-aware default.
 *
 * @example u.insLeft(4)
 * @example css({ left: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insLeft<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ left: boxLength(value) }));
}
