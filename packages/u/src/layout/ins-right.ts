/**
 * Physical `right` for an anchor-positioned surface whose offset follows the
 * fixed viewport side its anchor popped out on; inset otherwise stays
 * logical-property-first through `u.insIe()` and its siblings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { boxLength } from "../internal/tokens";

/**
 * Applies the physical `right` property, for offsets genuinely tied to the
 * viewport's right side. `u.insIe()` (`inset-inline-end`) covers the
 * writing-direction-aware default.
 *
 * @example u.insRight(4)
 * @example css({ right: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insRight<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ right: boxLength(value) }));
}
