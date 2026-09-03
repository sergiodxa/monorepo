/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Whether a programmatic or anchor-triggered scroll jumps or animates. */
export type ScrollBehaviorValue = "auto" | "smooth";

/**
 * Applies `scroll-behavior`, defaulting to `"smooth"`, so anchor jumps and
 * programmatic scrolls animate. Smooth scrolling is motion: wrap the call in
 * `u.motionSafe()` to honor a reduced-motion preference with an instant jump.
 *
 * @example u.scrollBehavior()
 * @example css({ scrollBehavior: "smooth" })
 * @example u.motionSafe(u.scrollBehavior())
 * @example css({ "@media (prefers-reduced-motion: no-preference)": { scrollBehavior: "smooth" } })
 * @example u.scrollBehavior("auto")
 * @example css({ scrollBehavior: "auto" })
 */
export function scrollBehavior<Node extends Element = Element>(
	value: ScrollBehaviorValue = "smooth",
) {
	return utility<Node>(() => ({ scrollBehavior: value }));
}
