/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { media } from "./media.js";

/**
 * Sugar over `media("(prefers-reduced-motion: reduce)", input)`.
 *
 * Prefer `u.motionSafe()` when there is a choice: declaring motion only
 * inside the positive query lets a missing wrapper fall back to no motion.
 *
 * @example u.motionReduce(u.transitionDuration("0s"))
 * @example css({ "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" } })
 */
export function motionReduce<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-motion: reduce)", input);
}
