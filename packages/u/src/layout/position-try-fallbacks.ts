/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the CSS Anchor Positioning `position-try-fallbacks` property,
 * listing one or more fallback position-try options (a named try tactic
 * like `"flip-block"`, or a `--custom-position-try` reference) the browser
 * tries in order when the element's preferred position overflows its
 * containing block.
 *
 * @example u.positionTryFallbacks("flip-block")
 * @example css({ positionTryFallbacks: "flip-block" })
 * @example u.positionTryFallbacks("flip-block", "flip-inline")
 * @example css({ positionTryFallbacks: "flip-block, flip-inline" })
 */
export function positionTryFallbacks<Node extends Element = Element>(...values: string[]) {
	return utility<Node>(() => ({ positionTryFallbacks: values.join(", ") }));
}
