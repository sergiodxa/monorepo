/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { spacing } from "../internal/tokens.js";

/**
 * Applies `padding-inline-end` — the trailing inline edge, which is the
 * right edge in `ltr` and the left edge in `rtl`.
 *
 * @example u.pie(4)
 * @example css({ paddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function pie<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingInlineEnd: spacing(value) }));
}
