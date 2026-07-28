/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-motion: reduce)", input)`.
 *
 * The opposite approach to `u.motionSafe()`: animate by default, then
 * neutralise the motion here. The usual content is
 * `u.transitionDuration("0s")`, or a swap to a non-motion property such as
 * opacity so the state change still reads without movement.
 *
 * Prefer `u.motionSafe()` when there is a choice — declaring motion only
 * inside the positive query means a missing wrapper degrades to no motion
 * instead of to unrequested motion.
 *
 * @example u.motionReduce(u.transitionDuration("0s"))
 * @example css({ "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" } })
 */
export function motionReduce<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-motion: reduce)", input);
}
