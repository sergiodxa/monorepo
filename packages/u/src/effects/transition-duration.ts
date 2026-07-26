/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `transition-duration` property on its own — for overriding
 * just the duration of a transition already declared elsewhere (e.g. a
 * `prefers-reduced-motion` media query that should shrink the duration to
 * zero without re-declaring `transition-property`/`transition-timing-function`).
 *
 * @example u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s"))
 * @example css({ "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" } })
 */
export function transitionDuration<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ transitionDuration: value }));
}
