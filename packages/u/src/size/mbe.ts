/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `margin-block-end` — the trailing block edge, the bottom edge in
 * a horizontal writing mode.
 *
 * @example u.mbe(4)
 * @example css({ marginBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function mbe<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginBlockEnd: spacing(value) }));
}
