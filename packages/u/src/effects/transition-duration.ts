/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `transition-duration` on its own, so a media query such as
 * `prefers-reduced-motion` can shrink an already-declared transition to zero
 * while its property list and timing function stay in place.
 *
 * @example u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s"))
 * @example css({ "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" } })
 */
export function transitionDuration<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ transitionDuration: value }));
}
