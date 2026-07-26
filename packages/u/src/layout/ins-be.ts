/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `inset-block-end` — the trailing block edge, the bottom edge in a
 * horizontal writing mode.
 *
 * @example u.insBe(4)
 * @example css({ insetBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insBe<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ insetBlockEnd: spacing(value) }));
}
