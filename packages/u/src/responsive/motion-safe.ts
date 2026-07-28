/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-motion: no-preference)", input)`.
 *
 * The correct default home for a transition or an animation. The styles
 * inside only apply for users who have not asked for less motion, so the
 * reduced-motion case is simply the unwrapped baseline — it needs no extra
 * rule to neutralise anything, because nothing was ever declared for it.
 *
 * This positive-polarity form is safer than gating with the negative one:
 * forgetting the wrapper entirely means no animation at all, rather than an
 * ungated animation that ignores the preference.
 *
 * @example u.motionSafe(u.transitionDuration("150ms"))
 * @example css({ "@media (prefers-reduced-motion: no-preference)": { transitionDuration: "150ms" } })
 */
export function motionSafe<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-motion: no-preference)", input);
}
