/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type InterpolateSizeValue = "allow-keywords" | "numeric-only";

/**
 * Opts the element into animating to and from keyword sizes (`auto`,
 * `min-content`, `max-content`, `fit-content`) instead of only numeric
 * lengths, so a transition to `height: auto` (or `block-size: auto`) can
 * actually animate rather than jumping instantly.
 *
 * @example u.interpolateSize()
 * @example css({ interpolateSize: "allow-keywords" })
 */
export function interpolateSize<Node extends Element = Element>(
	value: InterpolateSizeValue = "allow-keywords",
) {
	return utility<Node>(() => ({ interpolateSize: value }));
}
