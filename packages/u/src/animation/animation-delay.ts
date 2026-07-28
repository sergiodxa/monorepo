/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `animation-delay` property, offsetting when the host element's
 * animation starts relative to when it was applied. String-only: a delay is a
 * `<time>`, so it always carries a unit (`"150ms"`, `"0.3s"`) and there is no
 * scale to look a bare number up in.
 *
 * `u.animation()` already takes a `delay` key, and that is the one to reach
 * for when the same call declares the animation. This standalone exists for
 * the other case: overriding the delay of an animation declared *elsewhere*.
 * The usual shape is a wrapper staggering its children — one shared
 * `u.animation()` call supplies the `@keyframes`, duration, and easing, while
 * each item only shifts its own start time by index. Note the delay is applied
 * per element, so the animation itself stays a single declaration.
 *
 * A **negative** delay does not wait — it seeks. The animation starts
 * immediately, already advanced by that much of its duration, so a `-500ms`
 * delay on a `1s` animation begins half-way through. That is how a looping
 * animation is seeded as "already in progress" rather than snapping in from
 * its first keyframe, and it is also why a negative delay can make an entry
 * animation appear to skip its opening frames.
 *
 * @example u.animationDelay("150ms")
 * @example css({ animationDelay: "150ms" })
 * @example u.animationDelay()
 * @example css({ animationDelay: "0s" })
 * @example u.animationDelay(`${index * 60}ms`)
 * @example css({ animationDelay: "120ms" })
 * @example u.animationDelay("-500ms")
 * @example css({ animationDelay: "-500ms" })
 */
export function animationDelay<Node extends Element = Element>(value: string = "0s") {
	return utility<Node>(() => ({ animationDelay: value }));
}
