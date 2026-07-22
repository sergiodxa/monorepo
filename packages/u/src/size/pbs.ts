/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `padding-block-start` — the leading block edge, the top edge in
 * a horizontal writing mode.
 *
 * @example u.pbs(4)
 * @example css({ paddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function pbs<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ paddingBlockStart: spacing(value) }));
}
