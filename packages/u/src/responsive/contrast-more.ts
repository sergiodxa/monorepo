/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-contrast: more)", input)`.
 *
 * The theme layer already promotes every tone's subtle `border` to its
 * `border-strong` value under this query, so a call site usually does not
 * need this wrapper for borders at all — they strengthen on their own.
 *
 * Reach for it when something *else* needs strengthening: raising a muted
 * foreground to full contrast, or giving a decorative divider that normally
 * sits at low contrast enough weight to be visible.
 *
 * @example u.contrastMore(u.fg("neutral.emphasis"))
 * @example css({ "@media (prefers-contrast: more)": { color: "var(--ui-neutral-fg-emphasis)" } })
 */
export function contrastMore<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-contrast: more)", input);
}
