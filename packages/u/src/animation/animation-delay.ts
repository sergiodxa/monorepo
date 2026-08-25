/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `animation-delay` property. The value is a `<time>` string, so
 * it always carries its unit, and a negative delay seeks: the animation starts
 * immediately, already advanced by that much of its duration.
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
