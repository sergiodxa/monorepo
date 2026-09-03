/**
 * Physical `top` for an anchor-positioned surface whose offset follows the
 * fixed viewport side its anchor popped out on; inset otherwise stays
 * logical-property-first through `u.insBs()` and its siblings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SizeValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { boxLength } from "../internal/tokens.js";

/**
 * Applies the physical `top` property, for offsets genuinely tied to the
 * viewport's top side. `u.insBs()` (`inset-block-start`) covers the
 * writing-direction-aware default.
 *
 * @example u.insTop(4)
 * @example css({ top: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insTop<Node extends Element = Element>(value: SizeValue) {
	return utility<Node>(() => ({ top: boxLength(value) }));
}
