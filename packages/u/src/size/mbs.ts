/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `margin-block-start` — the leading block edge, the top edge in a
 * horizontal writing mode.
 *
 * @example u.mbs(4)
 * @example css({ marginBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function mbs<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginBlockStart: spacing(value) }));
}
