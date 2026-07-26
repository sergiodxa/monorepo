/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `inset-inline-start` — the leading inline edge, which is the left
 * edge in `ltr` and the right edge in `rtl`.
 *
 * @example u.insIs(4)
 * @example css({ insetInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
export function insIs<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ insetInlineStart: spacing(value) }));
}
