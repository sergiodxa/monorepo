/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { spacing } from "../internal/tokens.js";

/**
 * Applies `inset-inline-end` — the trailing inline edge, which is the right
 * edge in `ltr` and the left edge in `rtl`.
 *
 * @example u.insIe(4)
 * @example css({ insetInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insIe<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ insetInlineEnd: spacing(value) }));
}
