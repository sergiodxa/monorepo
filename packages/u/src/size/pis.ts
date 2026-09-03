/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { utility } from "../internal/descriptor.js";
import { spacing } from "../internal/tokens.js";

/**
 * Applies `padding-inline-start` — the leading inline edge, which is the
 * left edge in `ltr` and the right edge in `rtl`.
 *
 * @example u.pis(4)
 * @example css({ paddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function pis<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingInlineStart: spacing(value) }));
}
