/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies the CSS Anchor Positioning `position-try-fallbacks` property,
 * listing named tactics or `--custom-position-try` references tried in order
 * when the preferred position overflows its containing block.
 *
 * @example u.positionTryFallbacks("flip-block")
 * @example css({ positionTryFallbacks: "flip-block" })
 * @example u.positionTryFallbacks("flip-block", "flip-inline")
 * @example css({ positionTryFallbacks: "flip-block, flip-inline" })
 */
export function positionTryFallbacks<Node extends Element = Element>(...values: string[]) {
	return utility<Node>(() => ({ positionTryFallbacks: values.join(", ") }));
}
