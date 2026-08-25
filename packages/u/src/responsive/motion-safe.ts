/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-motion: no-preference)", input)`. Styles
 * apply only when the user has not asked for less motion, so a missing
 * wrapper safely defaults to no animation.
 *
 * @example u.motionSafe(u.transitionDuration("150ms"))
 * @example css({ "@media (prefers-reduced-motion: no-preference)": { transitionDuration: "150ms" } })
 */
export function motionSafe<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-motion: no-preference)", input);
}
