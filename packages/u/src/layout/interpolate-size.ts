/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type InterpolateSizeValue = "allow-keywords" | "numeric-only";

/**
 * Opts the element into animating to and from keyword sizes (`auto`,
 * `min-content`, `max-content`, `fit-content`), so a transition to
 * `height: auto` or `block-size: auto` animates across its full duration.
 *
 * @example u.interpolateSize()
 * @example css({ interpolateSize: "allow-keywords" })
 */
export function interpolateSize<Node extends Element = Element>(
	value: InterpolateSizeValue = "allow-keywords",
) {
	return utility<Node>(() => ({ interpolateSize: value }));
}
