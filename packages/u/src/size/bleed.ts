/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { spacing } from "../internal/tokens";

import { mi } from "./mi";

/**
 * Pulls the host past its container's inline padding by `value` on both
 * sides through a negative inline margin — a full-bleed image or divider
 * inside an otherwise padded section. Composes `u.mi()` with a negated
 * length.
 *
 * @example u.bleed(4)
 * @example css({ marginInline: "calc(-1 * calc(var(--ui-spacing, 0.25rem) * 4))" })
 */
export function bleed<Node extends Element = Element>(value: SpacingValue = 4) {
	return mi<Node>(`calc(-1 * ${spacing(value)})`);
}
