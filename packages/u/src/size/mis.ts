/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { utility } from "../internal/descriptor";
import { spacing } from "../internal/tokens";

/**
 * Applies `margin-inline-start` — the leading inline edge, which is the
 * left edge in `ltr` and the right edge in `rtl`.
 *
 * @example u.mis("auto")
 * @example css({ marginInlineStart: "auto" })
 */
export function mis<Node extends Element = Element>(value: SpacingValue) {
	return utility<Node>(() => ({ marginInlineStart: spacing(value) }));
}
