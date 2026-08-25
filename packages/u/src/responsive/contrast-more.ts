/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-contrast: more)", input)`.
 *
 * The theme layer already strengthens every tone's `border` here; reach for
 * this wrapper to strengthen other properties, like a muted foreground.
 *
 * @example u.contrastMore(u.fg("neutral.emphasis"))
 * @example css({ "@media (prefers-contrast: more)": { color: "var(--ui-neutral-fg-emphasis)" } })
 */
export function contrastMore<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-contrast: more)", input);
}
