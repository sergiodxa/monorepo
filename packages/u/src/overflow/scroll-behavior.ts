/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Whether a programmatic or anchor-triggered scroll jumps or animates. */
export type ScrollBehaviorValue = "auto" | "smooth";

/**
 * Applies `scroll-behavior`, defaulting to `"smooth"`, so anchor jumps and
 * programmatic scrolls (`scrollIntoView`, `scrollTo`) animate instead of
 * teleporting.
 *
 * Accessibility caveat, stated plainly: smooth scrolling is motion, and this
 * utility does not gate itself. Applying it unconditionally overrides the
 * preference of anyone who asked for reduced motion, and a long smooth scroll
 * is exactly the kind of movement that triggers vestibular discomfort. Wrap
 * the call in `u.motionSafe()` so the animation is opt-in for people who
 * tolerate it and the default stays an instant jump.
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
