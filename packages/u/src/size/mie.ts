/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { spacing } from "../internal/tokens.js";

/**
 * Applies `margin-inline-end` — the trailing inline edge, which is the
 * right edge in `ltr` and the left edge in `rtl`.
 *
 * @example u.mie("auto")
 * @example css({ marginInlineEnd: "auto" })
 */
export function mie<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginInlineEnd: spacing(value) }));
}
