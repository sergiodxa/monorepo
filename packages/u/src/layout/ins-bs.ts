/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `inset-block-start` — the leading block edge, the top edge in a
 * horizontal writing mode.
 *
 * @example u.insBs(4)
 * @example css({ insetBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insBs<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ insetBlockStart: spacing(value) }));
}
